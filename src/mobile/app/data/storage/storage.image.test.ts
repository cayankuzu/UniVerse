jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp",
  },
  manipulateAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Image: {
    getSize: jest.fn(),
  },
  NativeModules: {
    NativeVideoNormalizer: {
      normalize: jest.fn(),
    },
  },
  Platform: {
    OS: "ios",
  },
}));

import { copyAsync, deleteAsync, getInfoAsync } from "expo-file-system/legacy";
import { manipulateAsync } from "expo-image-manipulator";
import { Image, NativeModules, Platform } from "react-native";
import { normalizeStorageUploadFile } from "./storage.image";
import {
  MAX_IMAGE_UPLOAD_DIMENSION_PX,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
} from "../../shared/media/mediaVideoUtils";

const mockGetInfoAsync = getInfoAsync as jest.Mock;
const mockCopyAsync = copyAsync as jest.Mock;
const mockDeleteAsync = deleteAsync as jest.Mock;
const mockManipulateAsync = manipulateAsync as jest.Mock;
const mockImageGetSize = Image.getSize as jest.Mock;
const mockVideoNormalize = NativeModules.NativeVideoNormalizer.normalize as jest.Mock;

describe("normalizeStorageUploadFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = "ios";
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockVideoNormalize.mockResolvedValue(null);
    const { makeDirectoryAsync } = jest.requireMock("expo-file-system/legacy") as {
      makeDirectoryAsync: jest.Mock;
    };
    makeDirectoryAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 512_000,
      uri: "file:///input.jpg",
    });
    mockManipulateAsync.mockResolvedValue({
      height: 1024,
      uri: "file:///normalized.jpg",
      width: 2048,
    });
    mockImageGetSize.mockImplementation((uri, onSuccess) => onSuccess(1200, 900));
  });

  it("returns remote files unchanged", async () => {
    await expect(
      normalizeStorageUploadFile(
        {
          name: "remote.jpg",
          type: "image/jpeg",
          uri: "https://cdn.example.com/photo.jpg",
        },
        "events",
      ),
    ).resolves.toEqual({
      name: "remote.jpg",
      type: "image/jpeg",
      uri: "https://cdn.example.com/photo.jpg",
    });

    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(mockManipulateAsync).not.toHaveBeenCalled();
  });

  it("resizes and recompresses oversized event images to the 1080p ceiling", async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 6 * 1024 * 1024,
      uri: "file:///oversized.jpg",
    });
    mockImageGetSize.mockImplementation((uri, onSuccess) => onSuccess(3200, 1600));

    const normalized = await normalizeStorageUploadFile(
      {
        name: "event-cover.jpg",
        type: "image/jpeg",
        uri: "file:///oversized.jpg",
      },
      "events",
    );

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      "file:///oversized.jpg",
      [{ resize: { height: 960, width: 1920 } }],
      {
        compress: 0.7,
        format: "webp",
      },
    );
    expect(normalized.type).toBe("image/webp");
    expect(normalized.uri).toBe("file:///normalized.jpg");
    expect(String(normalized.name || "")).toMatch(/\.webp$/);
  });

  it("normalizes content uris and preserves png avatars at the 1080p ceiling", async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 3 * 1024 * 1024,
      uri: "file:///cache/storage-normalize-cache/normalize-avatar.jpg",
    });
    mockImageGetSize.mockImplementation((uri, onSuccess) => onSuccess(2400, 2400));

    const normalized = await normalizeStorageUploadFile(
      {
        name: "club-logo.png",
        type: "image/png",
        uri: "content://media/external/images/1",
      },
      "avatars",
    );

    expect(mockCopyAsync).toHaveBeenCalled();
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/storage-normalize-cache\//),
      [
        {
          resize: {
            height: MAX_IMAGE_UPLOAD_DIMENSION_PX,
            width: MAX_IMAGE_UPLOAD_DIMENSION_PX,
          },
        },
      ],
      {
        compress: 0.74,
        format: "png",
      },
    );
    expect(normalized.type).toBe("image/png");
    expect(String(normalized.name || "")).toMatch(/\.png$/);
    expect(mockDeleteAsync).toHaveBeenCalled();
  });

  it("rejects source files that exceed the absolute source size ceiling", async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 60 * 1024 * 1024,
      uri: "file:///too-large.jpg",
    });

    await expect(
      normalizeStorageUploadFile(
        {
          name: "too-large.jpg",
          type: "image/jpeg",
          uri: "file:///too-large.jpg",
        },
        "events",
      ),
    ).rejects.toThrow("Fotoğraf boyutu çok büyük. Lütfen daha küçük bir görsel seç.");
  });

  it("normalizes Android videos to mp4 before upload", async () => {
    (Platform as { OS: string }).OS = "android";
    let normalizedCacheExists = false;
    mockCopyAsync.mockImplementation(async () => {
      normalizedCacheExists = true;
    });
    mockVideoNormalize.mockResolvedValue({
      durationMs: MAX_VIDEO_DURATION_SECONDS * 1000,
      height: 1080,
      mimeType: "video/mp4",
      sizeBytes: MAX_VIDEO_UPLOAD_BYTES - 2048,
      uri: "file:///normalized-video.mp4",
      width: 1920,
    });
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: String(uri).includes("oversized-source-normalized.mp4")
        ? normalizedCacheExists
        : true,
      isDirectory: false,
      size:
        String(uri).includes("normalized-video.mp4") ||
        String(uri).includes("oversized-source-normalized.mp4")
          ? MAX_VIDEO_UPLOAD_BYTES - 2048
          : MAX_VIDEO_UPLOAD_BYTES + 8 * 1024 * 1024,
      uri,
    }));

    const normalized = await normalizeStorageUploadFile(
      {
        name: "album-video.mov",
        type: "video/quicktime",
        uri: "file:///oversized-source.mov",
      },
      "albums",
    );

    expect(mockVideoNormalize).toHaveBeenCalledWith(
      "file:///oversized-source.mov",
      "album-video",
      MAX_VIDEO_DURATION_SECONDS,
      1920,
      1080,
      8_500_000,
      192_000,
      MAX_VIDEO_UPLOAD_BYTES,
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "file:///normalized-video.mp4",
      to: "file:///oversized-source-normalized.mp4",
    });
    expect(normalized.type).toBe("video/mp4");
    expect(normalized.uri).toBe("file:///oversized-source-normalized.mp4");
    expect(String(normalized.name || "")).toMatch(/\.mp4$/);
  });

  it("rejects Android video uploads when native normalization is unavailable", async () => {
    (Platform as { OS: string }).OS = "android";
    mockVideoNormalize.mockResolvedValue(null);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: !String(uri).includes("album-video-normalized.mp4"),
      isDirectory: false,
      size: MAX_VIDEO_UPLOAD_BYTES - 4096,
      uri,
    }));

    await expect(
      normalizeStorageUploadFile(
        {
          name: "album-video.mp4",
          type: "video/mp4",
          uri: "file:///album-video.mp4",
        },
        "albums",
      ),
    ).rejects.toThrow(
      "Video 1080p olarak hazırlanamadı. Lütfen daha kısa veya farklı bir video seçip tekrar dene.",
    );
  });

  it("rejects Android video uploads when normalization fails unexpectedly", async () => {
    (Platform as { OS: string }).OS = "android";
    mockVideoNormalize.mockRejectedValue({
      code: "E_NORMALIZE_FAILED",
      message:
        "Video 1080p olarak hazırlanamadı. Lütfen daha kısa veya farklı bir video seçip tekrar dene.",
    });
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: !String(uri).includes("album-video-normalized.mp4"),
      isDirectory: false,
      size: MAX_VIDEO_UPLOAD_BYTES - 4096,
      uri,
    }));

    await expect(
      normalizeStorageUploadFile(
        {
          name: "album-video.mp4",
          type: "video/mp4",
          uri: "file:///album-video.mp4",
        },
        "albums",
      ),
    ).rejects.toThrow(
      "Video 1080p olarak hazırlanamadı. Lütfen daha kısa veya farklı bir video seçip tekrar dene.",
    );
  });

  it("reuses cached normalized Android videos on retry", async () => {
    (Platform as { OS: string }).OS = "android";
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: true,
      isDirectory: false,
      size: String(uri).includes("album-video-normalized.mp4")
        ? MAX_VIDEO_UPLOAD_BYTES - 4096
        : MAX_VIDEO_UPLOAD_BYTES + 1,
      uri,
    }));

    const normalized = await normalizeStorageUploadFile(
      {
        name: "album-video.mp4",
        type: "video/mp4",
        uri: "file:///album-video.mp4",
      },
      "albums",
    );

    expect(mockVideoNormalize).not.toHaveBeenCalled();
    expect(mockCopyAsync).not.toHaveBeenCalled();
    expect(normalized).toMatchObject({
      type: "video/mp4",
      uri: "file:///album-video-normalized.mp4",
    });
  });

  it("rejects videos that exceed the 1080p upload ceiling", async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: MAX_VIDEO_UPLOAD_BYTES + 1,
      uri: "file:///too-large-video.mp4",
    });

    await expect(
      normalizeStorageUploadFile(
        {
          name: "too-large-video.mp4",
          type: "video/mp4",
          uri: "file:///too-large-video.mp4",
        },
        "albums",
      ),
    ).rejects.toThrow(
      "Video boyutu çok büyük. 1080p olarak hazırlandığında en fazla 201 MB video yükleyebilirsin.",
    );
  });
});
