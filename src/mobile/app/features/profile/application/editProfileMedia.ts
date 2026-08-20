import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  captureCameraImageSelection,
  chooseMediaSourceAction,
  requestLibraryPermission,
} from "../../../shared/media/mediaPicker";
import { showInfoAlert } from "../../../shared/utils/alerts";

export async function pickEditProfileImage(type: "profile" | "cover") {
  let resolvedUri: string | null = null;

  const action = await chooseMediaSourceAction({
    allowVideo: false,
    title: type === "profile" ? "Profil medyası" : "Kapak medyası",
  });
  if (action === "cancel") return null;

  try {
    if (action === "camera-photo") {
      const selection = await captureCameraImageSelection({ quality: 0.85 });
      if (selection?.uri) {
        resolvedUri = selection.uri;
      }
      return resolvedUri;
    }

    await requestLibraryPermission();
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ["images"],
      ...(Platform.OS === "ios"
        ? {
            preferredAssetRepresentationMode:
              ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            presentationStyle: ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN,
            shouldDownloadFromNetwork: true,
          }
        : {}),
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      resolvedUri = result.assets[0].uri;
    }
  } catch {
    showInfoAlert("İzin Gerekli", "Görsel seçmek için izin gerekli.");
  }

  return resolvedUri;
}
