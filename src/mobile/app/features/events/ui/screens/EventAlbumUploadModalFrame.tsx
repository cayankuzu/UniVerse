import type { PropsWithChildren } from "react";
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ImagePlus, Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppModalHost, AppScrollView as ScrollView } from "../../../../shared/components";
import { MAX_ALBUM_MEDIA_ITEMS } from "../../../../shared/media/mediaPicker";
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_LIMIT_MB,
  MAX_VIDEO_UPLOAD_GRACE_SECONDS,
} from "../../../../shared/media/mediaVideoUtils";
import { tokens } from "../../../../shared/theme";

interface EventAlbumUploadModalFrameProps extends PropsWithChildren {
  modalBottomPadding: number;
  onClose: () => void;
  remainingAlbumSlots: number;
  sheetMaxHeight: number;
  visible: boolean;
}

export function EventAlbumUploadModalFrame({
  children,
  modalBottomPadding,
  onClose,
  remainingAlbumSlots,
  sheetMaxHeight,
  visible,
}: EventAlbumUploadModalFrameProps) {
  const insets = useSafeAreaInsets();
  const safeSheetMaxHeight = Math.max(320, sheetMaxHeight - insets.top - 16);

  return (
    <AppModalHost
      accessibilityAnnouncement="Albüm medyası yükle"
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            onPress={onClose}
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(2,6,23,0.5)",
            }}
          />

          <View
            style={{
              paddingHorizontal: tokens.spacing.sm,
              paddingTop: Math.max(insets.top + 16, 32),
              paddingBottom: Math.max(modalBottomPadding, insets.bottom + 16),
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{
                width: "100%",
                borderRadius: tokens.radius["3xl"],
                backgroundColor: tokens.colors.surface,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                minHeight: 320,
                maxHeight: safeSheetMaxHeight,
                overflow: "hidden",
                ...tokens.shadow.lg,
              }}
              contentContainerStyle={{
                flexGrow: 1,
                padding: tokens.spacing.md,
                gap: 14,
                paddingBottom: modalBottomPadding + 12,
              }}
            >
              <View
                style={{
                  borderRadius: 22,
                  backgroundColor: tokens.colors.surfaceTint,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  padding: 14,
                  gap: tokens.spacing.sm,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.sm }}
                >
                  <Pressable
                    accessibilityLabel="Geri"
                    hitSlop={tokens.hitSlop.sm}
                    onPress={onClose}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tokens.colors.surface,
                      borderWidth: 1,
                      borderColor: tokens.colors.borderLight,
                    }}
                  >
                    <ArrowLeft size={tokens.iconSize.lg} color={tokens.colors.primary} />
                  </Pressable>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: tokens.radius.lg,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tokens.colors.primarySoft,
                    }}
                  >
                    <ImagePlus size={tokens.iconSize.xl} color={tokens.colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: tokens.colors.foreground,
                        fontSize: tokens.typography.subtitle + 2,
                        fontWeight: tokens.fontWeight.extrabold,
                      }}
                    >
                      Medya ekle
                    </Text>
                    <Text
                      style={{
                        color: tokens.colors.muted,
                        fontSize: tokens.typography.caption,
                        fontWeight: tokens.fontWeight.semibold,
                      }}
                    >
                      Bir album kartina foto ve video ekle.
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: tokens.radius.pill,
                      backgroundColor: tokens.colors.primarySofter,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Sparkles size={tokens.iconSize.xs} color={tokens.colors.primary} />
                    <Text
                      style={{
                        color: tokens.colors.primary,
                        fontSize: tokens.typography.tiny,
                        fontWeight: tokens.fontWeight.extrabold,
                      }}
                    >
                      {MAX_ALBUM_MEDIA_ITEMS} medya
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs }}>
                  <View
                    style={{
                      borderRadius: tokens.radius.pill,
                      backgroundColor: tokens.colors.primarySofter,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.primaryDark,
                        fontSize: tokens.typography.tiny,
                        fontWeight: tokens.fontWeight.bold,
                      }}
                    >
                      Album hakki: {remainingAlbumSlots}/3
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: tokens.radius.pill,
                      backgroundColor: tokens.colors.warningSurface,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.warning,
                        fontSize: tokens.typography.tiny,
                        fontWeight: tokens.fontWeight.bold,
                      }}
                    >
                      Video basi: {Math.floor(MAX_VIDEO_DURATION_SECONDS / 60)} dk, 1080p tavan:{" "}
                      {MAX_VIDEO_UPLOAD_LIMIT_MB} MB ({MAX_VIDEO_UPLOAD_GRACE_SECONDS} sn boyut
                      payi)
                    </Text>
                  </View>
                </View>
              </View>
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModalHost>
  );
}
