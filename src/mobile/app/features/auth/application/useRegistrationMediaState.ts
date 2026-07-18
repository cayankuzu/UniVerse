import { useState } from "react";
import {
  captureCameraImageSelection,
  type MediaSelection,
  waitForMediaPickerTransition,
} from "../../../shared/media/mediaPicker";

export function useRegistrationMediaState(setSubmitError: (value: string) => void) {
  const [profileImageUri, setProfileImageUri] = useState("");
  const [coverImageUri, setCoverImageUri] = useState("");
  const [mediaTarget, setMediaTarget] = useState<"profile" | "cover">("profile");
  const [mediaSourceVisible, setMediaSourceVisible] = useState(false);
  const [mediaLibraryVisible, setMediaLibraryVisible] = useState(false);

  const handlePicked = (target: "profile" | "cover", uri: string) => {
    if (target === "profile") {
      setProfileImageUri(uri);
      return;
    }
    setCoverImageUri(uri);
  };

  const pickImage = (target: "profile" | "cover") => {
    setMediaTarget(target);
    setMediaSourceVisible(true);
  };

  const closeMediaSourcePicker = () => setMediaSourceVisible(false);
  const closeMediaLibraryPicker = () => setMediaLibraryVisible(false);

  const handleMediaSourceAction = async (action: "camera-photo" | "camera-video" | "library") => {
    setMediaSourceVisible(false);
    await waitForMediaPickerTransition();
    const handlePicked = (uri: string) => {
      if (mediaTarget === "profile") {
        setProfileImageUri(uri);
        return;
      }
      setCoverImageUri(uri);
    };

    try {
      if (action === "camera-photo") {
        const selection = await captureCameraImageSelection({ quality: 0.8 });
        if (selection?.uri) {
          handlePicked(selection.uri);
        }
        return;
      }

      if (action === "library") {
        setMediaLibraryVisible(true);
      }
    } catch (error) {
      setSubmitError(
        String((error as { message?: string } | null)?.message || "Görsel seçilemedi."),
      );
    }
  };

  const handleMediaLibrarySelection = (items: MediaSelection[]) => {
    const first = items[0];
    if (!first?.uri) return;
    handlePicked(mediaTarget, first.uri);
    setMediaLibraryVisible(false);
  };

  return {
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    coverImageUri,
    handleMediaLibrarySelection,
    handleMediaSourceAction,
    mediaLibraryVisible,
    mediaSourceVisible,
    mediaTarget,
    pickImage,
    profileImageUri,
  };
}
