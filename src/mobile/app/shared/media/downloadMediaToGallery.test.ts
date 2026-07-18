const mockCopyAsync = jest.fn(async (_params?: unknown) => undefined);
const mockCreateAssetAsync = jest.fn(async (_uri?: string) => ({}));
const mockDeleteAsync = jest.fn(async (_uri?: string, _options?: unknown) => undefined);
const mockDownloadAsync = jest.fn(async (_source?: string, _target?: string) => ({}));
const mockMakeDirectoryAsync = jest.fn(async (_uri?: string, _options?: unknown) => undefined);
const mockRequestPermissionsAsync = jest.fn(async () => ({ granted: true }));
const mockResolveMediaUri = jest.fn(async (uri: string) => uri);
const mockSaveToLibraryAsync = jest.fn(async (_uri?: string) => undefined);

jest.mock("expo-media-library", () => ({
  createAssetAsync: (uri: string) => mockCreateAssetAsync(uri),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  saveToLibraryAsync: (uri: string) => mockSaveToLibraryAsync(uri),
}));
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: (params: unknown) => mockCopyAsync(params),
  deleteAsync: (uri: string, options: unknown) => mockDeleteAsync(uri, options),
  downloadAsync: (source: string, target: string) => mockDownloadAsync(source, target),
  makeDirectoryAsync: (uri: string, options: unknown) => mockMakeDirectoryAsync(uri, options),
}));
jest.mock("./mediaUri", () => ({
  resolveMediaUri: (uri: string) => mockResolveMediaUri(uri),
}));

import { downloadMediaToGallery } from "./downloadMediaToGallery";

describe("downloadMediaToGallery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockResolveMediaUri.mockImplementation(async (uri: string) => uri);
    mockCreateAssetAsync.mockResolvedValue({});
    mockSaveToLibraryAsync.mockResolvedValue(undefined);
  });

  it("saves a local URI directly after resolving it", async () => {
    mockResolveMediaUri.mockResolvedValue("file:///resolved/photo.jpg");

    await downloadMediaToGallery({ fileName: "My Photo.JPG", kind: "image", uri: "photo" });

    expect(mockCreateAssetAsync).toHaveBeenCalledWith("file:///resolved/photo.jpg");
    expect(mockDownloadAsync).not.toHaveBeenCalled();
  });

  it("downloads remote media to a temporary file and always cleans it", async () => {
    mockCreateAssetAsync.mockRejectedValueOnce(new Error("asset API unavailable"));

    await downloadMediaToGallery({
      fileName: "Launch Clip.MP4",
      kind: "video",
      uri: "https://cdn.example/clip.mp4",
    });

    expect(mockDownloadAsync).toHaveBeenCalledWith(
      "https://cdn.example/clip.mp4",
      expect.stringMatching(/launch-clip-.*\.mp4$/),
    );
    expect(mockSaveToLibraryAsync).toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true });
  });

  it("fails before file work when gallery permission is denied", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(
      downloadMediaToGallery({ kind: "image", uri: "file:///photo.jpg" }),
    ).rejects.toThrow("Galeri izni gerekli");
    expect(mockCreateAssetAsync).not.toHaveBeenCalled();
  });
});
