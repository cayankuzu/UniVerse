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
  isVideoUploadFile: jest.fn(() => false),
  normalizeStorageUploadFile: jest.fn(async (file: unknown) => file),
}));

import { StorageAPI } from "./storage";
import {
  directCreateSignedUrl,
  directSignedUrlWithClient,
  readStorageResponse,
  retryWithRefreshedSession,
} from "./storage.helpers";
import { normalizeStorageUploadFile } from "./storage.image";

const mockDirectCreateSignedUrl = directCreateSignedUrl as jest.Mock;
const mockDirectSignedUrlWithClient = directSignedUrlWithClient as jest.Mock;
const mockNormalizeStorageUploadFile = normalizeStorageUploadFile as jest.Mock;
const mockReadStorageResponse = readStorageResponse as jest.Mock;
const mockRetryWithRefreshedSession = retryWithRefreshedSession as jest.Mock;

describe("StorageAPI edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirectCreateSignedUrl.mockResolvedValue(null);
    mockDirectSignedUrlWithClient.mockResolvedValue(null);
    mockNormalizeStorageUploadFile.mockImplementation(async (file: unknown) => file);
    mockReadStorageResponse.mockResolvedValue({});
  });

  it("turns inaccessible local media into an actionable upload error", async () => {
    mockNormalizeStorageUploadFile.mockRejectedValueOnce(new Error("EACCES: permission denied"));

    await expect(
      StorageAPI.uploadFile(
        { name: "photo.jpg", type: "image/jpeg", uri: "file:///missing.jpg" },
        "albums",
      ),
    ).rejects.toThrow();
  });

  it("rejects unsuccessful upload-session creation", async () => {
    mockRetryWithRefreshedSession.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      StorageAPI.createUploadSession({
        folder: "albums",
        items: [],
        mutationId: "mutation-1",
      }),
    ).rejects.toThrow();
  });

  it("rejects unsuccessful session finalization and cancellation", async () => {
    mockRetryWithRefreshedSession
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(StorageAPI.finalizeUploadSession("session-1")).rejects.toThrow();
    await expect(StorageAPI.cancelUploadSession("session-1")).rejects.toThrow();
  });

  it("accepts an already absent upload session during cancellation", async () => {
    mockRetryWithRefreshedSession.mockResolvedValue({ ok: false, status: 404 });
    await expect(StorageAPI.cancelUploadSession("session-1")).resolves.toBeUndefined();
  });

  it.each([403, 429, 500])("maps signed URL response %s to an error", async (status) => {
    mockRetryWithRefreshedSession.mockResolvedValue({ ok: false, status });

    await expect(StorageAPI.getSignedUrl("albums/photo.jpg")).rejects.toThrow();
  });

  it("fails closed when successful URL responses and direct fallbacks contain no URL", async () => {
    mockRetryWithRefreshedSession.mockResolvedValue({ ok: true, status: 200 });

    await expect(StorageAPI.getSignedUrl("albums/photo.jpg")).rejects.toThrow();
  });
});
