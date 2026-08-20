import {
  chooseMediaSourceAction,
  requestLibraryPermission,
} from "../../../shared/media/mediaPicker";
import { showInfoAlert } from "../../../shared/utils/alerts";
import { pickEditProfileImage } from "./editProfileMedia";

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
  UIImagePickerPresentationStyle: { OVER_FULL_SCREEN: "overFullScreen" },
}));
jest.mock("../../../shared/media/mediaPicker", () => ({
  captureCameraImageSelection: jest.fn(),
  chooseMediaSourceAction: jest.fn(),
  requestLibraryPermission: jest.fn(),
}));
jest.mock("../../../shared/utils/alerts", () => ({
  showInfoAlert: jest.fn(),
}));

const mockChooseMediaSourceAction = chooseMediaSourceAction as jest.Mock;
const mockRequestLibraryPermission = requestLibraryPermission as jest.Mock;
const mockShowInfoAlert = showInfoAlert as jest.Mock;

describe("pickEditProfileImage", () => {
  it("surfaces permission failures and returns no image", async () => {
    mockChooseMediaSourceAction.mockResolvedValue("library");
    mockRequestLibraryPermission.mockRejectedValue(new Error("denied"));

    await expect(pickEditProfileImage("profile")).resolves.toBeNull();

    expect(mockShowInfoAlert).toHaveBeenCalledWith(
      "İzin Gerekli",
      "Görsel seçmek için izin gerekli.",
    );
  });
});
