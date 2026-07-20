import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearMutationActionQueueStorage,
  enqueueMutationAction,
  getMutationActionDeadLetterQueue,
  getMutationActionEntry,
  getMutationActionQueue,
  processMutationActionQueue,
  subscribeMutationAction,
} from "./mutationActionQueue";

describe("mutationActionQueue", () => {
  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("processes queued actions in FIFO order and resolves listeners", async () => {
    const firstEntry = await enqueueMutationAction({
      id: "follow:user-1",
      kind: "follow-toggle",
      payload: { username: "user-1" },
    });
    const secondEntry = await enqueueMutationAction({
      id: "follow:user-2",
      kind: "follow-toggle",
      payload: { username: "user-2" },
    });
    const listener = jest.fn();
    subscribeMutationAction(firstEntry.id, listener);
    const handledIds: string[] = [];

    await processMutationActionQueue({
      handler: async (entry) => {
        handledIds.push(entry.id);
        return { status: "following" };
      },
      kind: "follow-toggle",
    });

    expect(handledIds).toEqual([firstEntry.id, secondEntry.id]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        result: { status: "following" },
        status: "resolved",
      }),
    );
    await expect(getMutationActionQueue("follow-toggle")).resolves.toEqual([]);
  });

  it("keeps transient failures pending until the retry backoff elapses", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    await enqueueMutationAction({
      id: "event-comment:event-1:local-1",
      kind: "event-comment-create",
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    const listener = jest.fn();
    subscribeMutationAction("event-comment:event-1:local-1", listener);
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error("network request failed"))
      .mockResolvedValueOnce({ id: "comment-1" });

    await processMutationActionQueue({
      handler,
      kind: "event-comment-create",
      ownerId: "viewer-1",
    });

    const queuedAfterFirstAttempt = await getMutationActionEntry("event-comment:event-1:local-1");
    expect(queuedAfterFirstAttempt).toEqual(
      expect.objectContaining({
        attemptCount: 1,
        ownerId: "viewer-1",
        status: "pending",
      }),
    );
    expect(listener).not.toHaveBeenCalled();

    jest.setSystemTime(new Date("2026-03-18T00:00:02.000Z"));
    await processMutationActionQueue({
      handler,
      kind: "event-comment-create",
      ownerId: "viewer-1",
    });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        result: { id: "comment-1" },
        status: "resolved",
      }),
    );
    await expect(getMutationActionQueue("event-comment-create", "viewer-1")).resolves.toEqual([]);
  });

  it("keeps one user's queued mutations isolated from another user", async () => {
    await enqueueMutationAction({
      id: "follow:user-1",
      kind: "follow-toggle",
      ownerId: "viewer-1",
      payload: { username: "user-1" },
    });
    const handler = jest.fn().mockResolvedValue({ status: "following" });

    await processMutationActionQueue({
      handler,
      kind: "follow-toggle",
      ownerId: "viewer-2",
    });

    expect(handler).not.toHaveBeenCalled();
    expect(await getMutationActionQueue("follow-toggle", "viewer-1")).toHaveLength(1);
  });

  it("deduplicates the same persisted mutation id without changing its idempotency payload", async () => {
    await enqueueMutationAction({
      id: "event-comment:event-1:local-1",
      kind: "event-comment-create",
      ownerId: "viewer-1",
      payload: { clientMutationId: "stable-1", text: "first" },
    });

    const duplicate = await enqueueMutationAction({
      id: "event-comment:event-1:local-1",
      kind: "event-comment-create",
      ownerId: "viewer-1",
      payload: { clientMutationId: "unstable-2", text: "second" },
    });

    expect(duplicate.payload).toEqual({ clientMutationId: "stable-1", text: "first" });
    await expect(getMutationActionQueue("event-comment-create", "viewer-1")).resolves.toHaveLength(
      1,
    );
  });

  it("rejects cross-owner queue id collisions without overwriting the first owner", async () => {
    await enqueueMutationAction({
      id: "follow:user-1",
      kind: "follow-toggle",
      ownerId: "viewer-1",
      payload: { targetStatus: "following" },
    });

    await expect(
      enqueueMutationAction({
        id: "follow:user-1",
        kind: "follow-toggle",
        ownerId: "viewer-2",
        payload: { targetStatus: "none" },
      }),
    ).rejects.toThrow("Queue entry id already belongs to another action.");

    await expect(getMutationActionEntry("follow:user-1")).resolves.toEqual(
      expect.objectContaining({
        ownerId: "viewer-1",
        payload: { targetStatus: "following" },
      }),
    );
  });

  it("retains retryable offline mutations even after their nominal attempt limit", async () => {
    await enqueueMutationAction({
      id: "offline-like",
      kind: "event-like-toggle",
      maxAttempts: 1,
      ownerId: "viewer-1",
      payload: { eventId: "event-1", targetLiked: true },
    });

    await processMutationActionQueue({
      handler: async () => {
        throw new Error("network request failed");
      },
      kind: "event-like-toggle",
      ownerId: "viewer-1",
    });

    await expect(getMutationActionEntry("offline-like")).resolves.toEqual(
      expect.objectContaining({
        attemptCount: 1,
        status: "pending",
        terminalAt: null,
      }),
    );
  });

  it("drains independent interaction entries with bounded concurrency", async () => {
    for (let index = 0; index < 4; index += 1) {
      await enqueueMutationAction({
        id: `event-like:${index}`,
        kind: "event-like-toggle",
        ownerId: "viewer-1",
        payload: { eventId: String(index) },
      });
    }

    let releaseFirstBatch: () => void = () => {};
    const firstBatchGate = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });
    let active = 0;
    let maxActive = 0;
    const handler = jest.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await firstBatchGate;
      active -= 1;
      return { ok: true };
    });

    const processing = processMutationActionQueue({
      handler,
      kind: "event-like-toggle",
      maxConcurrentEntries: 3,
      ownerId: "viewer-1",
    });
    for (let attempt = 0; attempt < 20 && handler.mock.calls.length < 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(handler).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(3);
    releaseFirstBatch();
    await processing;
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("exposes terminal mutations through the owner-scoped dead-letter queue", async () => {
    await enqueueMutationAction({
      id: "mutation-terminal",
      kind: "follow-toggle",
      maxAttempts: 1,
      ownerId: "viewer-1",
      payload: { targetUserId: "target-1" },
    });

    await processMutationActionQueue({
      handler: async () => {
        throw Object.assign(new Error("invalid mutation"), { retryableQueueError: false });
      },
      kind: "follow-toggle",
      ownerId: "viewer-1",
    });

    await expect(getMutationActionDeadLetterQueue("viewer-2")).resolves.toEqual([]);
    await expect(getMutationActionDeadLetterQueue("viewer-1")).resolves.toEqual([
      expect.objectContaining({
        id: "mutation-terminal",
        schemaVersion: 1,
        status: "failed",
        terminalAt: expect.any(String),
      }),
    ]);
  });
});
