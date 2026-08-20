import * as ImagePicker from "expo-image-picker";
import {
  captureCameraImageSelection,
  filterSelectableMediaSelections,
  requestLibraryPermission,
} from "../../../shared/media/mediaPicker";
import { captureTimedVideoSelection } from "../../../shared/media/nativeTimedVideoCapture";
import { showInfoAlert } from "../../../shared/utils/alerts";
import {
  pickAlbumMediaFromCamera,
  pickAlbumMediaFromLibrary,
  showAlbumUploadAlert,
} from "./albumMediaPicker";

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
  UIImagePickerPresentationStyle: { OVER_FULL_SCREEN: "overFullScreen" },
  VideoExportPreset: { H264_1920x1080: "h264" },
}));
jest.mock("../../../shared/media/mediaPicker", () => ({
  captureCameraImageSelection: jest.fn(),
  filterSelectableMediaSelections: jest.fn(),
  requestLibraryPermission: jest.fn(async () => undefined),
}));
jest.mock("../../../shared/media/nativeTimedVideoCapture", () => ({
  captureTimedVideoSelection: jest.fn(),
}));
jest.mock("../../../shared/utils/alerts", () => ({
  showInfoAlert: jest.fn(),
}));

const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockCaptureCameraImageSelection = captureCameraImageSelection as jest.Mock;
const mockFilterSelectableMediaSelections = filterSelectableMediaSelections as jest.Mock;
const mockRequestLibraryPermission = requestLibraryPermission as jest.Mock;
const mockCaptureTimedVideoSelection = captureTimedVideoSelection as jest.Mock;
const mockShowInfoAlert = showInfoAlert as jest.Mock;

describe("albumMediaPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes warnings to the caller or the shared information alert", () => {
    const onWarning = jest.fn();

    showAlbumUploadAlert("  Uyarı  ", onWarning);
    showAlbumUploadAlert("Varsayılan uyarı");
    showAlbumUploadAlert("   ");

    expect(onWarning).toHaveBeenCalledWith("Uyarı");
    expect(mockShowInfoAlert).toHaveBeenCalledWith("Albüm Medyası", "Varsayılan uyarı");
  });

  it("honors available library slots and filters the selected media", async () => {
    const selections = [{ kind: "image", uri: "file://one.jpg" }];
    mockLaunchImageLibraryAsync.mockResolvedValue({
      assets: [{ type: "image", uri: "file://one.jpg" }],
      canceled: false,
    });
    mockFilterSelectableMediaSelections.mockReturnValue(selections);

    await expect(pickAlbumMediaFromLibrary(0)).resolves.toEqual([]);
    await expect(pickAlbumMediaFromLibrary(1)).resolves.toEqual(selections);

    expect(mockRequestLibraryPermission).toHaveBeenCalledTimes(2);
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }),
    );
  });

  it("delegates camera photos and videos to their native capture paths", async () => {
    const photo = { kind: "image", uri: "file://photo.jpg" };
    const video = { kind: "video", uri: "file://video.mp4" };
    mockCaptureCameraImageSelection.mockResolvedValue(photo);
    mockCaptureTimedVideoSelection.mockResolvedValue(video);

    await expect(pickAlbumMediaFromCamera("photo")).resolves.toEqual(photo);
    await expect(pickAlbumMediaFromCamera("video")).resolves.toEqual(video);
  });
});
