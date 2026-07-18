import React from "react";
import { Pressable, StatusBar, View, useWindowDimensions } from "react-native";
import { AppImage } from "./AppImage";
import { AppModalHost } from "./AppModalHost";
import { getResponsiveLayoutTokens } from "../layout/responsive";

interface ImageViewerModalProps {
  onClose: () => void;
  uri?: string | null;
  visible: boolean;
}

export function ImageViewerModal({ onClose, uri, visible }: ImageViewerModalProps) {
  const { height, width } = useWindowDimensions();
  const tokens = getResponsiveLayoutTokens(width, height);

  return (
    <AppModalHost
      accessibilityAnnouncement="Görsel önizleme"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Gorsel onizleme"
        accessibilityRole="imagebutton"
        accessibilityViewIsModal
        style={{
          alignItems: "center",
          backgroundColor: "rgba(2,6,23,0.9)",
          flex: 1,
          justifyContent: "center",
          padding: tokens.spacing.modalPadding,
        }}
        onPress={onClose}
      >
        <StatusBar barStyle="light-content" />
        <View
          style={{
            backgroundColor: "#0f172a",
            borderColor: "rgba(148,163,184,0.35)",
            borderRadius: 16,
            borderWidth: 1,
            maxHeight: "84%",
            maxWidth: tokens.media.modalMaxWidth,
            overflow: "hidden",
            width: "100%",
          }}
        >
          {uri ? (
            <AppImage
              uri={uri}
              variant="full"
              style={{ height: tokens.media.imageViewerHeight, width: "100%" }}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Pressable>
    </AppModalHost>
  );
}
