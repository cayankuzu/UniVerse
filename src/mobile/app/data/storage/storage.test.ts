jest.mock("./storage.helpers", () => ({
  SUPABASE_CLIENT_INFO: "test-client",
  buildUploadFormData: jest.fn(),
  directCreateSignedUrl: jest.fn(),
  directSignedUrlWithClient: jest.fn(),
  directUploadWithRest: jest.fn(),
  normalizeStorageText: jest.fn((value: unknown) => String(value || "").trim()),
  readStorageResponse: jest.fn(),
  retryWithRefreshedSession: jest.fn(),
}));

jest.mock("./storage.image", () => ({
  isVideoUploadFile: jest.fn(
    (file: { type?: string; name?: string }) =>
      String(file?.type || "").startsWith("video/") || String(file?.name || "").endsWith(".mp4"),
  ),
  normalizeStorageUploadFile: jest.fn(async (file: unknown) => file),
}));

import { StorageAPI } from "./storage";
import {
  directUploadWithRest,
  readStorageResponse,
  retryWithRefreshedSession,
} from "./storage.helpers";

const mockDirectUploadWithRest = directUploadWithRest as jest.Mock;
const mockReadStorageResponse = readStorageResponse as jest.Mock;
const mockRetryWithRefreshedSession = retryWithRefreshedSession as jest.Mock;

describe("StorageAPI.uploadFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes video uploads directly to storage without the edge upload proxy", async () => {
    mockDirectUploadWithRest.mockResolvedValue("albums/user-1/video.mp4");

    await expect(
      StorageAPI.uploadFile(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        {
          context: "test/video-upload",
          uploadKey: "video-key",
        },
      ),
    ).resolves.toBe("albums/user-1/video.mp4");

    expect(mockDirectUploadWithRest).toHaveBeenCalledWith(
      {
        name: "clip.mp4",
        type: "video/mp4",
        uri: "file:///clip.mp4",
      },
      "albums",
      "test/video-upload",
      undefined,
      "video-key",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(mockRetryWithRefreshedSession).not.toHaveBeenCalled();
  });

  it("fails video uploads with a retryable timeout instead of waiting forever", async () => {
    jest.useFakeTimers();
    try {
      mockDirectUploadWithRest.mockImplementation(() => new Promise(() => undefined));

      const uploadPromise = StorageAPI.uploadFile(
        {
          name: "clip.mp4",
          type: "video/mp4",
          uri: "file:///clip.mp4",
        },
        "albums",
        {
          context: "test/video-timeout",
          timeoutMs: 5,
          uploadKey: "video-timeout-key",
        },
      );

      const rejection = uploadPromise.catch((error) => error);
      await jest.advanceTimersByTimeAsync(10);

      const error = await rejection;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Storage upload timeout.");
      expect(error).toMatchObject({
        retryableQueueError: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not bypass the edge upload proxy for image upload failures", async () => {
    mockRetryWithRefreshedSession.mockResolvedValue({
      ok: false,
      status: 500,
    });
    mockReadStorageResponse.mockResolvedValue({
      error: "provider failed",
    });

    await expect(
      StorageAPI.uploadFile(
        {
          name: "photo.jpg",
          type: "image/jpeg",
          uri: "file:///photo.jpg",
        },
        "albums",
        {
          context: "test/image-upload",
          uploadKey: "image-key",
        },
      ),
    ).rejects.toThrow("Dosya yüklenemedi.");

    expect(mockRetryWithRefreshedSession).toHaveBeenCalledTimes(1);
    expect(mockDirectUploadWithRest).not.toHaveBeenCalled();
  });
});

describe("StorageAPI.createUploadSession", () => {
  const params = {
    accessToken: "access-token",
    folder: "albums" as const,
    items: [
      {
        checksum: "a".repeat(64),
        contentType: "image/jpeg",
        expectedSizeBytes: 123,
        mediaIndex: 0,
        sourceName: "photo.jpg",
      },
    ],
    mutationId: "mutation-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRetryWithRefreshedSession.mockResolvedValue({ ok: true, status: 200 });
  });

  it("normalizes a complete upload session ticket", async () => {
    mockReadStorageResponse.mockResolvedValue({
      sessionId: " session-1 ",
      tickets: [
        {
          expectedSizeBytes: "123",
          mediaIndex: "0",
          path: " albums/user/photo.jpg ",
          uploadToken: " upload-token ",
          uploadUrl: " https://upload.example/photo ",
        },
      ],
    });

    await expect(StorageAPI.createUploadSession(params)).resolves.toEqual({
      sessionId: "session-1",
      tickets: [
        {
          expectedSizeBytes: 123,
          mediaIndex: 0,
          path: "albums/user/photo.jpg",
          uploadToken: "upload-token",
          uploadUrl: "https://upload.example/photo",
        },
      ],
    });
  });

  it("fails closed for incomplete or mismatched ticket collections", async () => {
    mockReadStorageResponse.mockResolvedValue({
      sessionId: "session-1",
      tickets: [
        {
          expectedSizeBytes: 0,
          mediaIndex: 0.5,
          path: "",
          uploadToken: "",
          uploadUrl: "",
        },
      ],
    });
    await expect(StorageAPI.createUploadSession(params)).rejects.toThrow("Upload session yan");

    mockReadStorageResponse.mockResolvedValue({ sessionId: "session-1", tickets: [] });
    await expect(StorageAPI.createUploadSession(params)).rejects.toThrow("Upload session yan");
  });
});
