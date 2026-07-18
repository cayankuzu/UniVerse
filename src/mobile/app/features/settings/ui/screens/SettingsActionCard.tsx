import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";

interface SettingsActionCardProps {
  borderColor?: string;
  chevronColor?: string;
  disabled?: boolean;
  iconBackgroundColor: string;
  iconColor: string;
  Icon: LucideIcon;
  onPress: () => void;
  subtitle: string;
  subtitleColor?: string;
  title: string;
  titleColor?: string;
}

export const SettingsActionCard = React.memo(function SettingsActionCard({
  borderColor = "rgba(15,23,42,0.08)",
  chevronColor = "#cbd5e1",
  disabled,
  iconColor,
  iconBackgroundColor,
  Icon,
  onPress,
  subtitle,
  subtitleColor = "#64748b",
  title,
  titleColor = "#0f172a",
}: SettingsActionCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: "rgba(15,23,42,0.08)" }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 14,
        borderWidth: 1,
        borderColor,
        backgroundColor: "#fff",
        paddingHorizontal: 12,
        paddingVertical: 14,
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: disabled ? 0.65 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconBackgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: titleColor, fontSize: 14, fontWeight: "700" }}>{title}</Text>
        <Text style={{ marginTop: 1, color: subtitleColor, fontSize: 12 }}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={chevronColor} />
    </Pressable>
  );
});
