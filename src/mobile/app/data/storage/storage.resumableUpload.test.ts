import AsyncStorage from "@react-native-async-storage/async-storage";

type MockTusOptions = {
  chunkSize?: number;
  endpoint?: string | null;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  onError?: ((error: Error) => void) | null;
  onProgress?: ((sentBytes: number, totalBytes: number) => void) | null;
  onSuccess?: (() => void) | null;
  removeFingerprintOnSuccess?: boolean;
  retryDelays?: number[] | null;
  storeFingerprintForResuming?: boolean;
  uploadSize?: number | null;
  fileReader?: {
    closeAll: () => void;
    openFile: (input: { uri?: string }) => Promise<{
      close: () => void;
      size: number;
      slice: (start: number, end: number) => Promise<{ done: boolean; value: Blob | null }>;
    }>;
  };
  urlStorage?: {
    addUpload: (fingerprint: string, upload: Record<string, unknown>) => Promise<string>;
    findAllUploads: () => Promise<Record<string, unknown>[]>;
    findUploadsByFingerprint: (fingerprint: string) => Promise<Record<string, unknown>[]>;
    removeUpload: (storageKey: string) => Promise<void>;
  };
};

const mockAbort = jest.fn(async () => undefined);
const mockFindPreviousUploads = jest.fn();
const mockFileHandle = {
  close: jest.fn(),
  offset: 0,
  readBytes: jest.fn((length: number) => new Uint8Array(length)),
};
const mockResume = jest.fn();
let mockLatestOptions: MockTusOptions | null = null;
let mockStartError: Error | null = null;

jest.mock("tus-js-client", () => ({
  Upload: class MockTusUpload {
    options: MockTusOptions;

    constructor(_file: unknown, options: MockTusOptions) {
      this.options = options;
      mockLatestOptions = options;
    }

    abort = mockAbort;
    findPreviousUploads = mockFindPreviousUploads;
    resumeFromPreviousUpload = mockResume;
    start = jest.fn(() => {
      if (mockStartError) this.options.onError?.(mockStartError);
      else this.options.onSuccess?.();
    });
  },
}));

jest.mock("expo-file-system", () => ({
  File: class MockFile {
    exists: boolean;
    size: number;

    constructor(uri: string) {
      this.exists = Boolean(uri) && !uri.includes("missing");
      this.size = this.exists ? 7 : 0;
    }

    open() {
      return mockFileHandle;
    }
  },
}));

import { uploadFileResumably } from "./storage.resumableUpload";

function buildParams(signal?: AbortSignal) {
  return {
    accessToken: "access-token",
    contentType: "video/mp4",
    file: { name: "video.mp4", type: "video/mp4", uri: "file:///video.mp4" },
    signal,
    ticket: {
      expectedSizeBytes: 7_000_000,
      mediaIndex: 0,
      path: "albums/viewer/video.mp4",
      uploadToken: "signed-upload-token",
      uploadUrl: "https://signed.example/video",
    },
    uploadKey: "album-upload:0",
  };
}

describe("resumable storage upload", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockLatestOptions = null;
    mockStartError = null;
    mockFindPreviousUploads.mockResolvedValue([
      {
        creationTime: "2026-07-18T00:00:00.000Z",
        metadata: {},
        parallelUploadUrls: null,
        size: 7_000_000,
        uploadUrl: "https://resume.example/upload-1",
        urlStorageKey: "resume-key",
      },
    ]);
    await AsyncStorage.clear();
  });

  it("uses six-megabyte TUS chunks and resumes a stored upload", async () => {
    const onProgress = jest.fn();
    const upload = uploadFileResumably({ ...buildParams(), onProgress });
    mockLatestOptions?.onProgress?.(3_500_000, 7_000_000);
    await expect(upload).resolves.toBe("albums/viewer/video.mp4");

    expect(mockResume).toHaveBeenCalledWith(
      expect.objectContaining({ uploadUrl: "https://resume.example/upload-1" }),
    );
    expect(mockLatestOptions).toMatchObject({
      chunkSize: 6 * 1024 * 1024,
      headers: {
        apikey: expect.any(String),
        authorization: "Bearer access-token",
        "x-signature": "signed-upload-token",
        "x-upsert": "true",
      },
      metadata: {
        bucketName: "make-e3557d40-media",
        contentType: "video/mp4",
        objectName: "albums/viewer/video.mp4",
      },
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      uploadSize: 7_000_000,
    });
    expect(onProgress).toHaveBeenCalledWith(3_500_000, 7_000_000);
  });

  it("aborts the TUS request when the queue operation is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(uploadFileResumably(buildParams(controller.signal))).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(mockAbort).toHaveBeenCalledWith(false);
  });

  it("persists, restores, and repairs TUS resume metadata", async () => {
    await uploadFileResumably(buildParams());
    const storage = mockLatestOptions?.urlStorage;
    expect(storage).toBeDefined();
    if (!storage) throw new Error("TUS URL storage missing");

    const storedKey = await storage.addUpload("album upload:0", {
      creationTime: "2026-07-18T00:00:00.000Z",
      metadata: {},
      parallelUploadUrls: null,
      size: 7_000_000,
      uploadUrl: "https://resume.example/upload-2",
    });
    expect(storedKey).toContain("album%20upload%3A0");
    await AsyncStorage.setItem("universe:tus-upload:broken", "{broken-json");

    await expect(storage.findAllUploads()).resolves.toEqual([
      expect.objectContaining({ uploadUrl: "https://resume.example/upload-2" }),
    ]);
    await expect(AsyncStorage.getItem("universe:tus-upload:broken")).resolves.toBeNull();
    await expect(storage.findUploadsByFingerprint("album upload:0")).resolves.toEqual([
      expect.objectContaining({ urlStorageKey: storedKey }),
    ]);

    await AsyncStorage.setItem(storedKey, "{broken-json");
    await expect(storage.findUploadsByFingerprint("album upload:0")).resolves.toEqual([]);
    await storage.removeUpload(storedKey);
    await expect(storage.findAllUploads()).resolves.toEqual([]);
  });

  it("reads bounded file slices and closes native handles idempotently", async () => {
    await uploadFileResumably(buildParams());
    const fileReader = mockLatestOptions?.fileReader;
    expect(fileReader).toBeDefined();
    if (!fileReader) throw new Error("TUS file reader missing");

    const file = await fileReader.openFile({ uri: "file:///video.mp4" });
    await expect(file.slice(1, 5)).resolves.toMatchObject({ done: false });
    expect(mockFileHandle.offset).toBe(1);
    file.close();
    file.close();

    await fileReader.openFile({ uri: "file:///video.mp4" });
    fileReader.closeAll();
    await expect(fileReader.openFile({ uri: "file:///missing.mp4" })).rejects.toThrow(
      "medya dosyasi okunamadi",
    );
  });

  it("rejects missing authorization and transport failures", async () => {
    await expect(uploadFileResumably({ ...buildParams(), accessToken: "" })).rejects.toThrow(
      "yetkilendirmesi eksik",
    );

    mockFindPreviousUploads.mockRejectedValueOnce(new Error("resume lookup failed"));
    await expect(uploadFileResumably(buildParams())).rejects.toThrow("resume lookup failed");

    mockStartError = new Error("upload failed");
    await expect(uploadFileResumably(buildParams())).rejects.toThrow("upload failed");
  });
});
