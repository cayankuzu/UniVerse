import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Camera, ImageIcon, User } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
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
      <View style={{ gap: 8 }}>
        <Text style={{ color: tokens.colors.dark700, fontSize: 14, fontWeight: "500" }}>
          {label}
        </Text>
        <Pressable
          onPress={onPick}
          style={{
            height: 128,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.08)",
            backgroundColor: tokens.colors.surfaceVariant,
          }}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
              <ImageIcon size={28} color={tokens.colors.borderLight} />
              <Text style={{ color: tokens.colors.mutedFg, fontSize: 12 }}>
                {t("auth.imagePicker.selectPhoto")}
              </Text>
            </View>
          )}
          <View
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              borderRadius: 10,
              backgroundColor: tokens.colors.overlayLight,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: tokens.colors.surface, fontSize: 11, fontWeight: "600" }}>
              {uri ? t("auth.imagePicker.change") : t("auth.imagePicker.upload")}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: tokens.colors.dark700, fontSize: 14, fontWeight: "500" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable
          onPress={onPick}
          style={{ width: 80, height: 80, borderRadius: 16, overflow: "visible" }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
              }}
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={36} color={tokens.colors.borderLight} />
            </View>
          )}
          <View
            style={{
              position: "absolute",
              right: -4,
              bottom: -4,
              width: 22,
              height: 22,
              borderRadius: 8,
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
        <Text style={{ flex: 1, color: tokens.colors.mutedFg, fontSize: 13, lineHeight: 18 }}>
          {t("auth.imagePicker.optionalHint")}
        </Text>
      </View>
    </View>
  );
}
