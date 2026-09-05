import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Image, Pressable, View } from "react-native";
import { Camera, ImageIcon, User } from "lucide-react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

interface ImagePickerFieldProps {
  label: string;
  uri?: string | null;
  onPick: () => void;
  variant: "cover" | "avatar";
  accent: string;
}

export function ImagePickerField({ label, uri, onPick, variant, accent }: ImagePickerFieldProps) {
  if (variant === "cover") {
    return (
      <View style={{ gap: tokens.spacing.xs }}>
        <Text
          style={{
            color: tokens.colors.dark700,
            fontSize: tokens.typography.body,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${
            uri ? t("auth.imagePicker.change") : t("auth.imagePicker.upload")
          }`}
          style={{
            height: 104,
            borderRadius: tokens.radius.lg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: withAlpha(tokens.colors.foreground, 0.08),
            backgroundColor: tokens.colors.surfaceVariant,
          }}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.spacing.xxs,
              }}
            >
              <ImageIcon size={tokens.iconSize["2xl"]} color={tokens.colors.borderLight} />
              <Text style={{ color: tokens.colors.mutedFg, fontSize: tokens.typography.caption }}>
                {t("auth.imagePicker.selectPhoto")}
              </Text>
            </View>
          )}
          <View
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              borderRadius: tokens.radius.compact,
              backgroundColor: tokens.colors.overlayLight,
              paddingHorizontal: tokens.spacing.compact,
              paddingVertical: tokens.spacing.xxs,
            }}
          >
            <Text
              style={{
                color: tokens.colors.surface,
                fontSize: tokens.typography.caption,
                fontWeight: "600",
              }}
            >
              {uri ? t("auth.imagePicker.change") : t("auth.imagePicker.upload")}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text
        style={{
          color: tokens.colors.dark700,
          fontSize: tokens.typography.body,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.smPlus }}>
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${
            uri ? t("auth.imagePicker.change") : t("auth.imagePicker.upload")
          }`}
          style={{ width: 64, height: 64, borderRadius: tokens.radius.lg, overflow: "visible" }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: withAlpha(tokens.colors.foreground, 0.08),
              }}
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: "100%",
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: withAlpha(tokens.colors.foreground, 0.08),
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={tokens.iconSize["3xl"]} color={tokens.colors.borderLight} />
            </View>
          )}
          <View
            style={{
              position: "absolute",
              right: -4,
              bottom: -4,
              width: 22,
              height: 22,
              borderRadius: tokens.radius.sm,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: tokens.colors.surface,
              backgroundColor: accent,
            }}
          >
            <Camera size={12} color={tokens.colors.surface} />
          </View>
        </Pressable>
        <Text
          style={{
            flex: 1,
            color: tokens.colors.mutedFg,
            fontSize: tokens.typography.label,
            lineHeight: tokens.lineHeight.label,
          }}
        >
          {t("auth.imagePicker.optionalHint")}
        </Text>
      </View>
    </View>
  );
}
