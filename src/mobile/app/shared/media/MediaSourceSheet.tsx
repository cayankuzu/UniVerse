import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Camera, Check, Film, ImagePlus, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppModalHost } from "../components/AppModalHost";
import type { MediaSourceAction } from "./mediaPicker";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";

type Props = {
  allowVideo: boolean;
  description?: string;
  onClose: () => void;
  onSelect: (action: Exclude<MediaSourceAction, "cancel">) => void | Promise<void>;
  subtitle?: string;
  title: string;
  visible: boolean;
};

function SourceCard({
  disabled,
  hint,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  hint: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 120,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: disabled ? tokens.colors.border : tokens.colors.border,
        backgroundColor: disabled ? tokens.colors.background : tokens.colors.background,
        padding: 14,
        justifyContent: "space-between",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: tokens.minHeight.touchTarget,
          height: tokens.minHeight.touchTarget,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: disabled ? tokens.colors.border : tokens.colors.primarySofter,
        }}
      >
        {icon}
      </View>
      <View style={{ gap: 4 }}>
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.body,
            fontWeight: "800",
          }}
        >
          {label}
        </Text>
        <Text
          style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny, lineHeight: 14 }}
        >
          {hint}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Check size={12} color={disabled ? tokens.colors.muted : tokens.colors.primary} />
        <Text
          style={{
            color: disabled ? tokens.colors.muted : tokens.colors.primary,
            fontSize: tokens.typography.tiny,
            fontWeight: "700",
          }}
        >
          {t("media.source.title")}
        </Text>
      </View>
    </Pressable>
  );
}

export function MediaSourceSheet({
  allowVideo,
  description,
  onClose,
  onSelect,
  subtitle,
  title,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stackSources = width < 360;

  return (
    <AppModalHost
      accessibilityAnnouncement={title}
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(2,6,23,0.56)",
          justifyContent: "flex-end",
          paddingHorizontal: tokens.spacing.sm,
          paddingTop: tokens.spacing.sm,
          paddingBottom: Math.max(insets.bottom + 12, 20),
        }}
      >
        <Pressable
          accessibilityLabel={title}
          accessibilityRole="menu"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={{
            borderRadius: 28,
            backgroundColor: tokens.colors.surface,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(226,232,240,0.9)",
            shadowColor: "#020617",
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 18 },
            elevation: 18,
          }}
        >
          <View
            style={{
              paddingHorizontal: tokens.spacing.md,
              paddingTop: 14,
              paddingBottom: tokens.spacing.sm,
              backgroundColor: tokens.colors.background,
              borderBottomWidth: 1,
              borderBottomColor: tokens.colors.border,
              gap: tokens.spacing.xs,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.sm }}
            >
              <View
                style={{
                  width: tokens.minHeight.touchTarget,
                  height: tokens.minHeight.touchTarget,
                  borderRadius: tokens.radius.lg,
                  backgroundColor: tokens.colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImagePlus size={20} color={tokens.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.foreground, fontSize: 18, fontWeight: "800" }}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.caption,
                      fontWeight: "600",
                    }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
                onPress={onClose}
                style={{
                  width: tokens.minHeight.touchTarget,
                  height: tokens.minHeight.touchTarget,
                  borderRadius: tokens.radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.primarySofter,
                }}
              >
                <X size={16} color={tokens.colors.primary} />
              </Pressable>
            </View>
            {description ? (
              <Text
                style={{
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  lineHeight: 17,
                }}
              >
                {description}
              </Text>
            ) : null}
          </View>

          <View style={{ padding: tokens.spacing.md, gap: 14 }}>
            <View
              style={{
                flexDirection: stackSources ? "column" : "row",
                gap: 10,
              }}
            >
              <SourceCard
                hint={t("media.source.takePhotoHint")}
                icon={<Camera size={20} color={tokens.colors.primary} />}
                label={t("media.source.takePhoto")}
                onPress={() => void onSelect("camera-photo")}
              />
              <SourceCard
                hint={
                  allowVideo
                    ? t("media.source.recordVideoHint")
                    : t("media.source.recordVideoDisabled")
                }
                icon={
                  <Film
                    size={20}
                    color={allowVideo ? tokens.colors.primary : tokens.colors.muted}
                  />
                }
                label={t("media.source.recordVideo")}
                disabled={!allowVideo}
                onPress={() => {
                  if (allowVideo) void onSelect("camera-video");
                }}
              />
              <SourceCard
                hint={t("media.source.addMediaHint")}
                icon={<ImagePlus size={20} color={tokens.colors.primary} />}
                label={t("media.source.addMedia")}
                onPress={() => void onSelect("library")}
              />
            </View>

            <View
              style={{
                borderRadius: 20,
                backgroundColor: tokens.colors.background,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xs,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  backgroundColor: tokens.colors.primarySofter,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={14} color={tokens.colors.primary} />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.tiny,
                  lineHeight: 16,
                }}
              >
                {allowVideo ? t("media.source.videoLimit") : t("media.source.photoOnly")}
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
