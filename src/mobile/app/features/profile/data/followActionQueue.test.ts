import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { FollowAPI } from "../../../data/social";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import {
  clearMutationActionQueueStorage,
  getMutationActionEntry,
} from "../../../data/queues/mutationActionQueue";
import { processFollowActionQueue, queueFollowAction } from "./followActionQueue";

jest.mock("../../../data/social", () => ({
  FollowAPI: {
    toggle: jest.fn(),
  },
}));

jest.mock("../data/profileFollowMutationPolicy", () => ({
  commitProfileFollowMutation: jest.fn(),
  rollbackProfileFollowMutation: jest.fn(),
}));

const { commitProfileFollowMutation, rollbackProfileFollowMutation } = jest.requireMock(
  "../data/profileFollowMutationPolicy",
) as {
  commitProfileFollowMutation: jest.Mock;
  rollbackProfileFollowMutation: jest.Mock;
};

describe("followActionQueue", () => {
  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
    useOptimisticOutboxMetaStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("commits queued follow mutations and resolves optimistic outbox state", async () => {
    const queryClient = new QueryClient();
    useOptimisticOutboxMetaStore.getState().begin({
      action: "follow-toggle",
      entity: "profile-overview",
      id: "follow:user-1",
    });
    await queueFollowAction({
      outboxId: "follow:user-1",
      ownerId: "viewer-1",
      previousStatus: "none",
      targetStatus: "following",
      username: "user-1",
      viewerCacheKey: "viewer-1",
      viewerUsername: "viewer",
    });
    (FollowAPI.toggle as jest.Mock).mockResolvedValue({ status: "following" });

    await processFollowActionQueue({ ownerId: "viewer-1", queryClient });

    expect(FollowAPI.toggle).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        desiredStatus: "following",
        previousStatusHint: "none",
      }),
    );
    expect(commitProfileFollowMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "following",
        previousStatus: "none",
        username: "user-1",
      }),
    );
    expect(useOptimisticOutboxMetaStore.getState().entries["follow:user-1"]?.status).toBe(
      "resolved",
    );
  });

  it("rolls back queued follow mutations when the background request fails", async () => {
    const queryClient = new QueryClient();
    useOptimisticOutboxMetaStore.getState().begin({
      action: "follow-toggle",
      entity: "profile-overview",
      id: "follow:user-1",
    });
    await queueFollowAction({
      outboxFailReason: "follow-toggle-failed",
      outboxId: "follow:user-1",
      ownerId: "viewer-1",
      previousStatus: "following",
      targetStatus: "none",
      username: "user-1",
      viewerCacheKey: "viewer-1",
      viewerUsername: "viewer",
    });
    (FollowAPI.toggle as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    await processFollowActionQueue({ ownerId: "viewer-1", queryClient });

    expect(rollbackProfileFollowMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: "following",
        rolledBackFromStatus: "none",
        username: "user-1",
      }),
    );
    expect(useOptimisticOutboxMetaStore.getState().entries["follow:user-1"]?.status).toBe("failed");
  });

  it("keeps optimistic follow state pending on transient failures so retries can continue", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    const queryClient = new QueryClient();
    useOptimisticOutboxMetaStore.getState().begin({
      action: "follow-toggle",
      entity: "profile-overview",
      id: "follow:user-1",
    });
    await queueFollowAction({
      outboxFailReason: "follow-toggle-failed",
      outboxId: "follow:user-1",
      ownerId: "viewer-1",
      previousStatus: "none",
      targetStatus: "following",
      username: "user-1",
      viewerCacheKey: "viewer-1",
      viewerUsername: "viewer",
    });
    (FollowAPI.toggle as jest.Mock)
      .mockRejectedValueOnce(new Error("network request failed"))
      .mockResolvedValueOnce({ status: "following" });

    await processFollowActionQueue({ ownerId: "viewer-1", queryClient });

    expect(rollbackProfileFollowMutation).not.toHaveBeenCalled();
    expect(useOptimisticOutboxMetaStore.getState().entries["follow:user-1"]?.status).toBe(
      "pending",
    );

    jest.setSystemTime(new Date("2026-03-18T00:00:02.000Z"));
    await processFollowActionQueue({ ownerId: "viewer-1", queryClient });

    expect(commitProfileFollowMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "following",
        username: "user-1",
      }),
    );
    expect(useOptimisticOutboxMetaStore.getState().entries["follow:user-1"]?.status).toBe(
      "resolved",
    );
  });

  it("coalesces a superseded in-flight follow intent into one final commit", async () => {
    const queryClient = new QueryClient();
    useOptimisticOutboxMetaStore.getState().begin({
      action: "follow-toggle",
      entity: "profile-overview",
      id: "follow:user-1",
    });
    await queueFollowAction({
      outboxId: "follow:user-1",
      ownerId: "viewer-1",
      previousStatus: "none",
      targetStatus: "following",
      username: "user-1",
      viewerCacheKey: "viewer-1",
      viewerUsername: "viewer",
    });

    let resolveFirstRequest: ((value: { status: "following" }) => void) | null = null;
    (FollowAPI.toggle as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = resolve as (value: { status: "following" }) => void;
          }),
      )
      .mockResolvedValueOnce({ status: "none" });

    const processing = processFollowActionQueue({ ownerId: "viewer-1", queryClient });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const entry = await getMutationActionEntry("follow:user-1");
      if (entry?.status === "running") break;
      await Promise.resolve();
    }

    await queueFollowAction({
      clientMutationId: "follow-toggle-next",
      outboxId: "follow:user-1",
      ownerId: "viewer-1",
      previousStatus: "following",
      targetStatus: "none",
      username: "user-1",
      viewerCacheKey: "viewer-1",
      viewerUsername: "viewer",
    });
    expect(resolveFirstRequest).not.toBeNull();
    resolveFirstRequest!({ status: "following" });
    await processing;

    expect(FollowAPI.toggle).toHaveBeenCalledTimes(2);
    expect((FollowAPI.toggle as jest.Mock).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        desiredStatus: "following",
      }),
    );
    expect((FollowAPI.toggle as jest.Mock).mock.calls[1][1]).toEqual(
      expect.objectContaining({
        desiredStatus: "none",
      }),
    );
    expect(commitProfileFollowMutation).toHaveBeenCalledTimes(1);
    expect(commitProfileFollowMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "none",
        previousStatus: "following",
        username: "user-1",
      }),
    );
  });
});
