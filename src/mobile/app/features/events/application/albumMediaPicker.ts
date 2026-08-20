import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import {
  captureCameraImageSelection,
  filterSelectableMediaSelections,
  requestLibraryPermission,
  type MediaSelection,
} from "../../../shared/media/mediaPicker";
import { captureTimedVideoSelection } from "../../../shared/media/nativeTimedVideoCapture";
import { showInfoAlert } from "../../../shared/utils/alerts";

export function showAlbumUploadAlert(message: string, onWarning?: (message: string) => void) {
  const text = String(message || "").trim();
  if (!text) return;
  if (onWarning) {
    onWarning(text);
    return;
  }
  showInfoAlert("Albüm Medyası", text);
}

export async function pickAlbumMediaFromLibrary(availableSelectionSlots: number) {
  await requestLibraryPermission();
  if (availableSelectionSlots <= 0) return [] as MediaSelection[];

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: availableSelectionSlots > 1,
    allowsEditing: false,
    mediaTypes: ["images", "videos"],
    orderedSelection: true,
    ...(Platform.OS === "ios"
      ? {
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN,
          shouldDownloadFromNetwork: true,
          videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
        }
      : {}),
    quality: 0.85,
    selectionLimit: availableSelectionSlots,
  });

  if (result.canceled || !result.assets?.length) return [];
  return filterSelectableMediaSelections(result.assets, { allowVideo: true }).slice(
    0,
    availableSelectionSlots,
  );
}

export async function pickAlbumMediaFromCamera(kind: "photo" | "video") {
  if (kind === "video") {
    return captureTimedVideoSelection();
  }

  return captureCameraImageSelection({ quality: 0.85 });
}
