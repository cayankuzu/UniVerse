import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UseEventAlbumUploadModalLayoutParams {
  draggingPhotoUri: string;
  selectedPhotoIndex: number;
  selectedPhotoUris: string[];
  visible: boolean;
}

export function useEventAlbumUploadModalLayout(_params: UseEventAlbumUploadModalLayoutParams) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [previewWidth, setPreviewWidth] = useState(() => Math.max(Math.round(windowWidth - 32), 1));
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(Math.max(event.endCoordinates?.height || 0, 0));
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      hideSub.remove();
      showSub.remove();
    };
  }, []);

  const keyboardLift =
    Platform.OS === "android" ? Math.max(keyboardHeight - insets.bottom + 8, 0) : 0;

  return {
    modalBottomPadding: Math.max(insets.bottom + 12, 12) + keyboardLift,
    previewWidth,
    setPreviewWidth,
    sheetMaxHeight: Math.max(320, windowHeight - keyboardHeight - 24),
  };
}
