import React from "react";
import { Pressable, StatusBar, View, useWindowDimensions } from "react-native";
import { AppImage } from "./AppImage";
import { AppModalHost } from "./AppModalHost";
import { getResponsiveLayoutTokens } from "../layout/responsive";
import { tokens, withAlpha } from "../theme";

interface ImageViewerModalProps {
  onClose: () => void;
  uri?: string | null;
  visible: boolean;
}

export function ImageViewerModal({ onClose, uri, visible }: ImageViewerModalProps) {
  const { height, width } = useWindowDimensions();
  const layoutTokens = getResponsiveLayoutTokens(width, height);

  return (
    <AppModalHost
      accessibilityAnnouncement="Görsel önizleme"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Görsel önizleme"
        accessibilityRole="imagebutton"
        accessibilityViewIsModal
        style={{
          alignItems: "center",
          backgroundColor: withAlpha(tokens.colors.dark950, 0.9),
          flex: 1,
          justifyContent: "center",
          padding: layoutTokens.spacing.modalPadding,
        }}
        onPress={onClose}
      >
        <StatusBar barStyle="light-content" />
        <View
          style={{
            backgroundColor: tokens.colors.foreground,
            borderColor: withAlpha(tokens.colors.textSubtle, 0.35),
            borderRadius: tokens.radius.lg,
            borderWidth: 1,
            maxHeight: "84%",
            maxWidth: layoutTokens.media.modalMaxWidth,
            overflow: "hidden",
            width: "100%",
          }}
        >
          {uri ? (
            <AppImage
              uri={uri}
              variant="full"
              style={{ height: layoutTokens.media.imageViewerHeight, width: "100%" }}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Pressable>
    </AppModalHost>
  );
}
