jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  NativeModules: {
    NativeImageCropper: {
      crop: jest.fn(),
    },
  },
  Platform: {
    OS: "android",
  },
}));

import { copyAsync, getInfoAsync, makeDirectoryAsync } from "expo-file-system/legacy";
import { NativeModules } from "react-native";
import { cropEventAlbumPhoto } from "./eventAlbumNativeCrop";

const mockCopyAsync = copyAsync as jest.Mock;
const mockGetInfoAsync = getInfoAsync as jest.Mock;
const mockMakeDirectoryAsync = makeDirectoryAsync as jest.Mock;
const mockCrop = NativeModules.NativeImageCropper.crop as jest.Mock;

describe("cropEventAlbumPhoto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCopyAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 1024,
    });
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCrop.mockResolvedValue("file:///cache/cropped-image.jpg");
  });

  it("copies content uris into cache before invoking the native cropper", async () => {
    const result = await cropEventAlbumPhoto("content://media/external/images/media/42");

    expect(mockMakeDirectoryAsync).toHaveBeenCalled();
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "content://media/external/images/media/42",
      to: expect.stringMatching(/^file:\/\/\/cache\/native-image-cropper\/source-/),
    });
    expect(mockCrop).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/native-image-cropper\/source-/),
    );
    expect(result).toBe("file:///cache/cropped-image.jpg");
  });
});
