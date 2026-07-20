jest.mock("../../../data/storage/storage", () => ({
  StorageAPI: {
    cancelUploadSession: jest.fn(),
    createUploadSession: jest.fn(),
    prepareUploadFile: jest.fn(),
    uploadPreparedFile: jest.fn(),
  },
}));

jest.mock("../../../data/queues/uploadQueue", () => ({
  isRetryableUploadError: jest.fn(
    (error: { retryableQueueError?: boolean }) => error?.retryableQueueError === true,
  ),
}));

jest.mock("../../../platform/media/fileIntegrity", () => ({
  calculateLocalFileIntegrity: jest.fn(),
}));

import { StorageAPI } from "../../../data/storage/storage";
import { calculateLocalFileIntegrity } from "../../../platform/media/fileIntegrity";
import {
  resolvePreparedMediaUploadTimeoutMs,
  uploadPendingAlbumMedia,
} from "./albumUploadQueueProcessor.media";

const mockCalculateIntegrity = calculateLocalFileIntegrity as jest.Mock;
const mockCancelSession = StorageAPI.cancelUploadSession as jest.Mock;
const mockCreateSession = StorageAPI.createUploadSession as jest.Mock;
const mockPrepare = StorageAPI.prepareUploadFile as jest.Mock;
const mockUpload = StorageAPI.uploadPreparedFile as jest.Mock;

describe("uploadPendingAlbumMedia performance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.mockImplementation(async (file: { uri: string }) => ({
      name: file.uri.includes("video") ? "video-normalized.mp4" : "photo-normalized.webp",
      type: file.uri.includes("video") ? "video/mp4" : "image/webp",
      uri: file.uri.replace(/\.[^.]+$/, "-normalized.bin"),
    }));
    mockCalculateIntegrity.mockImplementation(async (uri: string) => ({
      checksumSha256: uri.includes("video") ? "b".repeat(64) : "a".repeat(64),
      sizeBytes: uri.includes("video") ? 2_000 : 1_000,
    }));
    mockCreateSession.mockImplementation(
      async ({ items }: { items: Array<{ expectedSizeBytes: number; mediaIndex: number }> }) => ({
        sessionId: "session-1",
        tickets: items.map((item) => ({
          ...item,
          path: `albums/viewer/${item.mediaIndex}`,
          uploadToken: "token",
          uploadUrl: `https://upload.example/${item.mediaIndex}`,
        })),
      }),
    );
  });

  it("allows a maximum-size video to finish on a slow uplink", () => {
    const timeoutMs = resolvePreparedMediaUploadTimeoutMs({
      baseTimeoutMs: 300_000,
      mediaKind: "video",
      sizeBytes: 200 * 1024 * 1024,
    });
    expect(timeoutMs).toBeGreaterThan(13 * 60_000);
    expect(timeoutMs).toBeLessThanOrEqual(30 * 60_000);
    expect(
      resolvePreparedMediaUploadTimeoutMs({
        baseTimeoutMs: 25_000,
        mediaKind: "image",
        sizeBytes: 2 * 1024 * 1024,
      }),
    ).toBe(25_000);
  });

  it("uploads two normalized files concurrently with monotonic byte progress", async () => {
    const releases: Array<() => void> = [];
    const progress: number[] = [];
    mockUpload.mockImplementation(
      async (
        file: { uri: string },
        _folder: string,
        options: { onProgress?: (sentBytes: number, totalBytes: number) => void },
      ) => {
        options.onProgress?.(file.uri.includes("video") ? 1_000 : 500, 2_000);
        await new Promise<void>((resolve) => releases.push(resolve));
        return file.uri.includes("video") ? "albums/viewer/video" : "albums/viewer/photo";
      },
    );

    const upload = uploadPendingAlbumMedia({
      assertActive: async () => undefined,
      authHints: { accessTokenHint: "access-token" },
      entryId: "entry-1",
      getTimeoutMs: () => 60_000,
      images: ["file:///photo.jpg", "file:///video.mov"],
      logError: jest.fn(),
      logStep: jest.fn(),
      patchProgress: async ({ payload, percent }) => {
        progress.push(percent);
        return payload;
      },
      payload: {},
      pendingUploads: [
        { index: 0, mediaKind: "image", sourceUri: "file:///photo.jpg" },
        { index: 1, mediaKind: "video", sourceUri: "file:///video.mov" },
      ],
      toSourceError: (error) => error,
      uploadedUrls: ["", ""],
      uploadSeed: "album-upload:1",
    });
    while (mockUpload.mock.calls.length < 2) await Promise.resolve();
    expect(mockUpload).toHaveBeenCalledTimes(2);
    releases.forEach((release) => release());
    await upload;

    expect(mockPrepare).toHaveBeenCalledTimes(2);
    expect(mockCalculateIntegrity).toHaveBeenCalledWith("file:///photo-normalized.bin");
    expect(mockCalculateIntegrity).toHaveBeenCalledWith("file:///video-normalized.bin");
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ checksum: "a".repeat(64), expectedSizeBytes: 1_000 }),
          expect.objectContaining({ checksum: "b".repeat(64), expectedSizeBytes: 2_000 }),
        ],
      }),
    );
    expect(progress).toEqual([...progress].sort((left, right) => left - right));
    expect(progress.some((percent) => percent > 22 && percent < 78)).toBe(true);
  });

  it("keeps successful checkpoints when a retryable transfer fails", async () => {
    const patchedPayloads: Record<string, unknown>[] = [];
    mockUpload.mockImplementation(async (file: { uri: string }) => {
      if (!file.uri.includes("video")) return "albums/viewer/photo";
      await Promise.resolve();
      throw Object.assign(new Error("network request failed"), { retryableQueueError: true });
    });

    await expect(
      uploadPendingAlbumMedia({
        assertActive: async () => undefined,
        authHints: { accessTokenHint: "access-token" },
        entryId: "entry-retry",
        getTimeoutMs: () => 60_000,
        images: ["file:///photo.jpg", "file:///video.mov"],
        logError: jest.fn(),
        logStep: jest.fn(),
        patchProgress: async ({ payload }) => {
          patchedPayloads.push(payload);
          return payload;
        },
        payload: {},
        pendingUploads: [
          { index: 0, mediaKind: "image", sourceUri: "file:///photo.jpg" },
          { index: 1, mediaKind: "video", sourceUri: "file:///video.mov" },
        ],
        toSourceError: (error) => error,
        uploadedUrls: ["", ""],
        uploadSeed: "album-upload:retry",
      }),
    ).rejects.toThrow("network request failed");

    expect(mockCancelSession).not.toHaveBeenCalled();
    expect(patchedPayloads.at(-1)).toEqual(
      expect.objectContaining({
        uploadedImages: ["albums/viewer/photo", ""],
        uploadSessionId: "session-1",
      }),
    );
  });
});
