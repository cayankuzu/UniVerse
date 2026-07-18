import React from "react";
import type { GestureResponderEvent } from "react-native";
import { Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";

type ActionButtonVariant = "card" | "list";

type Props = {
  acceptSelected: boolean;
  disabled: boolean;
  onAccept: (event: GestureResponderEvent) => void;
  onReject: (event: GestureResponderEvent) => void;
  rejectSelected: boolean;
  statusLabel?: string | null;
  variant?: ActionButtonVariant;
};

const BUTTON_VARIANTS = {
  card: {
    acceptIconSize: 13,
    borderRadius: 10,
    buttonGap: 4,
    buttonMinHeight: tokens.minHeight.touchTarget,
    rejectBackgroundColor: tokens.colors.surfaceVariant,
    rejectIconSize: 14,
    rejectIdleColor: tokens.colors.muted,
  },
  list: {
    acceptIconSize: 12,
    borderRadius: 9,
    buttonGap: 4,
    buttonMinHeight: tokens.minHeight.touchTarget,
    rejectBackgroundColor: tokens.colors.background,
    rejectIconSize: 12,
    rejectIdleColor: tokens.colors.dark600,
  },
} as const;

export const FollowRequestActionButtons = React.memo(function FollowRequestActionButtons({
  acceptSelected,
  disabled,
  onAccept,
  onReject,
  rejectSelected,
  statusLabel,
  variant = "list",
}: Props) {
  const config = BUTTON_VARIANTS[variant];

  return (
    <View style={{ alignItems: variant === "card" ? "flex-end" : "flex-start", gap: 5 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable
          accessibilityLabel="Takip istegini kabul et"
          accessibilityRole="button"
          onPress={onAccept}
          accessibilityState={{ disabled }}
          style={{
            minHeight: config.buttonMinHeight,
            borderRadius: config.borderRadius,
            backgroundColor:
              acceptSelected || (!disabled && !rejectSelected)
                ? tokens.colors.primary
                : tokens.colors.border,
            paddingHorizontal: 10,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: config.buttonGap,
            opacity: disabled ? 0.9 : 1,
          }}
        >
          <Check
            size={config.acceptIconSize}
            color={
              acceptSelected || (!disabled && !rejectSelected)
                ? tokens.colors.surface
                : tokens.colors.muted
            }
          />
          <Text
            style={{
              color:
                acceptSelected || (!disabled && !rejectSelected)
                  ? tokens.colors.surface
                  : tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: "700",
            }}
          >
            Kabul
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Takip istegini reddet"
          accessibilityRole="button"
          onPress={onReject}
          accessibilityState={{ disabled }}
          style={{
            minHeight: config.buttonMinHeight,
            borderRadius: config.borderRadius,
            borderWidth: 1,
            borderColor: rejectSelected ? tokens.colors.dangerBorder : tokens.colors.border,
            backgroundColor: rejectSelected
              ? tokens.colors.dangerSurface
              : config.rejectBackgroundColor,
            paddingHorizontal: 10,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: config.buttonGap,
            opacity: disabled ? 0.9 : 1,
          }}
        >
          <X
            size={config.rejectIconSize}
            color={rejectSelected ? tokens.colors.danger : config.rejectIdleColor}
          />
          <Text
            style={{
              color: rejectSelected ? tokens.colors.danger : config.rejectIdleColor,
              fontSize: tokens.typography.caption,
              fontWeight: "700",
            }}
          >
            Reddet
          </Text>
        </Pressable>
      </View>
      {statusLabel ? (
        <Text
          style={{
            color: acceptSelected ? tokens.colors.primary : tokens.colors.danger,
            fontSize: tokens.typography.caption,
            fontWeight: "700",
          }}
        >
          {statusLabel}
        </Text>
      ) : null}
    </View>
  );
});
