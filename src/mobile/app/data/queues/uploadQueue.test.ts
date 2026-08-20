import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearUploadQueueStorage,
  enqueueUpload,
  getUploadDeadLetterQueue,
  getUploadEntry,
  getUploadQueue,
  isRetryableUploadError,
  patchUploadEntry,
  processUploadQueue,
} from "./uploadQueue";
import { subscribeQueueResumeSignal } from "./runtimeSignals";

describe("uploadQueue", () => {
  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearUploadQueueStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("classifies transient upload transport failures for resumable checkpoints", () => {
    expect(isRetryableUploadError(new Error("network request failed"))).toBe(true);
    expect(isRetryableUploadError(new Error("HTTP 429"))).toBe(true);
    expect(isRetryableUploadError(new Error("video boyutu cok buyuk"))).toBe(false);
  });

  it("processes uploads in FIFO order", async () => {
    const firstEntry = await enqueueUpload({
      id: "upload-1",
      kind: "event-create",
      payload: { title: "First" },
    });
    const secondEntry = await enqueueUpload({
      id: "upload-2",
      kind: "event-create",
      payload: { title: "Second" },
    });
    const handledIds: string[] = [];

    await processUploadQueue({
      handler: async (entry) => {
        handledIds.push(entry.id);
      },
      kind: "event-create",
    });

    expect(handledIds).toEqual([firstEntry.id, secondEntry.id]);
    await expect(getUploadQueue("event-create")).resolves.toEqual([]);
  });

  it("keeps transient upload failures pending until retry backoff elapses", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    await enqueueUpload({
      id: "upload-1",
      kind: "album-photo",
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error("network request failed"))
      .mockResolvedValueOnce(undefined);

    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    expect(await getUploadEntry("upload-1")).toEqual(
      expect.objectContaining({
        attemptCount: 1,
        ownerId: "viewer-1",
        status: "pending",
      }),
    );

    jest.setSystemTime(new Date("2026-03-18T00:00:02.000Z"));
    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    expect(handler).toHaveBeenCalledTimes(2);
    await expect(getUploadQueue("album-photo", "viewer-1")).resolves.toEqual([]);
  });

  it("keeps uploads isolated to the authenticated owner when owner scope is provided", async () => {
    await enqueueUpload({
      id: "upload-1",
      kind: "event-create",
      ownerId: "viewer-1",
      payload: { title: "Hidden" },
    });
    const handler = jest.fn().mockResolvedValue(undefined);

    await processUploadQueue({
      handler,
      kind: "event-create",
      ownerId: "viewer-2",
    });

    expect(handler).not.toHaveBeenCalled();
    expect(await getUploadQueue("event-create", "viewer-1")).toHaveLength(1);
  });

  it("recovers an abandoned upload claim after process death", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    await enqueueUpload({
      id: "upload-abandoned",
      kind: "album-photo",
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    await patchUploadEntry("upload-abandoned", { status: "uploading" });

    jest.setSystemTime(new Date("2026-03-18T00:00:09.000Z"));
    const handler = jest.fn().mockResolvedValue(undefined);
    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: "upload-abandoned", status: "uploading" }),
    );
    await expect(getUploadEntry("upload-abandoned")).resolves.toBeNull();
  });

  it("emits a refresh signal after a successful queue removal", async () => {
    await enqueueUpload({
      id: "upload-1",
      kind: "album-photo",
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    const listener = jest.fn();
    const unsubscribe = subscribeQueueResumeSignal("upload", listener);
    const handler = jest.fn().mockResolvedValue(undefined);

    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    unsubscribe();
    expect(listener).toHaveBeenCalled();
    await expect(getUploadQueue("album-photo", "viewer-1")).resolves.toEqual([]);
  });

  it("retries explicit retryable queue errors even when their message looks unauthorized", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    await enqueueUpload({
      id: "upload-1",
      kind: "album-photo",
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    const authRecoveryError = Object.assign(
      new Error("Oturum dogrulanamadi. Uygulamayi yeniden acip tekrar dene."),
      {
        retryableQueueError: true,
      },
    );
    const handler = jest
      .fn()
      .mockRejectedValueOnce(authRecoveryError)
      .mockResolvedValueOnce(undefined);

    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    expect(await getUploadEntry("upload-1")).toEqual(
      expect.objectContaining({
        attemptCount: 1,
        ownerId: "viewer-1",
        status: "pending",
      }),
    );

    jest.setSystemTime(new Date("2026-03-18T00:00:02.000Z"));
    await processUploadQueue({
      handler,
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    expect(handler).toHaveBeenCalledTimes(2);
    await expect(getUploadQueue("album-photo", "viewer-1")).resolves.toEqual([]);
  });

  it("versions queue records and retains terminal failures in the dead-letter queue", async () => {
    const created = await enqueueUpload({
      id: "upload-terminal",
      kind: "album-photo",
      maxAttempts: 1,
      ownerId: "viewer-1",
      payload: { eventId: "event-1" },
    });
    expect(created).toEqual(expect.objectContaining({ schemaVersion: 1, terminalAt: null }));

    await processUploadQueue({
      handler: async () => {
        throw new Error("dosya seçilmedi");
      },
      kind: "album-photo",
      ownerId: "viewer-1",
    });

    const deadLetters = await getUploadDeadLetterQueue("viewer-1");
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toEqual(
      expect.objectContaining({
        attemptCount: 1,
        id: "upload-terminal",
        schemaVersion: 1,
        status: "failed",
        terminalAt: expect.any(String),
      }),
    );
  });
});
