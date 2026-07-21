import { ChevronRight } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { tokens, withAlpha } from "../../../../shared/theme";

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
  groupPosition?: "first" | "middle" | "last" | "only";
  separated?: boolean;
}

export const SettingsActionCard = React.memo(function SettingsActionCard({
  chevronColor = tokens.colors.borderStrong,
  disabled,
  iconColor,
  iconBackgroundColor,
  Icon,
  onPress,
  subtitle,
  subtitleColor = tokens.colors.muted,
  title,
  titleColor = tokens.colors.foreground,
  groupPosition = "only",
  separated = false,
}: SettingsActionCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: withAlpha(tokens.colors.foreground, 0.08) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        borderTopLeftRadius:
          groupPosition === "first" || groupPosition === "only" ? tokens.radius.control : 0,
        borderTopRightRadius:
          groupPosition === "first" || groupPosition === "only" ? tokens.radius.control : 0,
        borderBottomLeftRadius:
          groupPosition === "last" || groupPosition === "only" ? tokens.radius.control : 0,
        borderBottomRightRadius:
          groupPosition === "last" || groupPosition === "only" ? tokens.radius.control : 0,
        borderBottomWidth: groupPosition === "last" || groupPosition === "only" ? 0 : 1,
        borderBottomColor: tokens.colors.divider,
        backgroundColor: tokens.colors.onMedia,
        marginTop: separated ? tokens.spacing.xs : 0,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.smPlus,
        minHeight: tokens.minHeight.row,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.compact,
        opacity: disabled ? 0.65 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: tokens.radius.md,
          backgroundColor: iconBackgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: titleColor, fontSize: tokens.typography.body, fontWeight: "700" }}>
          {title}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.hairline,
            color: subtitleColor,
            fontSize: tokens.typography.caption,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={chevronColor} />
    </Pressable>
  );
});
