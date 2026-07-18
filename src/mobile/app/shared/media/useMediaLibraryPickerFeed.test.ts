import { renderHook, waitFor } from "@testing-library/react-native";

const mockGetAssetsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockHydrateLibraryAssetForPicker = jest.fn();
const mockGenerateVideoThumbnailUri = jest.fn();

jest.mock("expo-media-library", () => ({
  MediaType: {
    photo: "photo",
    video: "video",
  },
  SortBy: {
    creationTime: "creationTime",
  },
  getAssetsAsync: (...args: unknown[]) => mockGetAssetsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
}));

jest.mock("./mediaPicker", () => ({
  hydrateLibraryAssetForPicker: (...args: unknown[]) => mockHydrateLibraryAssetForPicker(...args),
}));

jest.mock("./videoThumbnailCache", () => ({
  generateVideoThumbnailUri: (...args: unknown[]) => mockGenerateVideoThumbnailUri(...args),
}));

jest.mock("../utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn((task: () => void) => {
    task();
    return { cancel: jest.fn() };
  }),
}));

describe("useMediaLibraryPickerFeed", () => {
  beforeEach(() => {
    mockGetAssetsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockHydrateLibraryAssetForPicker.mockReset();
    mockGenerateVideoThumbnailUri.mockReset();
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockHydrateLibraryAssetForPicker.mockImplementation(async (asset: Record<string, unknown>) => ({
      ...asset,
      previewCandidates: [String(asset.uri || "")],
      previewUri: String(asset.uri || ""),
      runtimeUri: String(asset.uri || ""),
    }));
  });

  it("loads the videos tab with a direct 33-item video query", async () => {
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        {
          duration: 12,
          id: "video-1",
          mediaType: "video",
          uri: "file:///video-1.mp4",
        },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    mockGenerateVideoThumbnailUri.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      require("./useMediaLibraryPickerFeed").useMediaLibraryPickerFeed({
        allowVideo: true,
        tab: "videos",
        visible: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.filteredAssets).toHaveLength(1);
    });

    expect(mockGetAssetsAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 33,
        mediaType: ["video"],
      }),
    );
  });

  it("attaches generated video thumbnails before tiles render them", async () => {
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        {
          duration: 18,
          id: "video-2",
          mediaType: "video",
          uri: "file:///video-2.mp4",
        },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    mockGenerateVideoThumbnailUri.mockResolvedValue("file:///video-2-thumb.jpg");

    const { result } = renderHook(() =>
      require("./useMediaLibraryPickerFeed").useMediaLibraryPickerFeed({
        allowVideo: true,
        tab: "videos",
        visible: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.filteredAssets[0]?.thumbnailUri).toBe("file:///video-2-thumb.jpg");
    });

    expect(result.current.filteredAssets[0]?.previewUri).toBe("file:///video-2-thumb.jpg");
    expect(mockGenerateVideoThumbnailUri).toHaveBeenCalledWith("file:///video-2.mp4", 0);
  });
});
