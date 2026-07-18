import React, { memo } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { tokens } from "../../shared/theme";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AppButtonSize = "sm" | "md" | "lg";

export interface AppButtonProps {
  accessibilityLabel?: string;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  label: string;
  disabled?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  mode?: "contained" | "outlined" | "text";
  onPress?: () => void;
  size?: AppButtonSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: AppButtonVariant;
}

const BUTTON_SIZE = {
  lg: { horizontal: 18, minHeight: 50, radius: tokens.radius.lg, textSize: 15 },
  md: {
    horizontal: 16,
    minHeight: tokens.minHeight.buttonMd,
    radius: tokens.radius.md,
    textSize: 14,
  },
  sm: {
    horizontal: 12,
    minHeight: tokens.minHeight.buttonSm,
    radius: tokens.radius.sm,
    textSize: 13,
  },
} as const;

function resolveMode(mode: AppButtonProps["mode"], variant: AppButtonVariant) {
  if (mode) return mode;
  if (variant === "ghost") return "outlined";
  if (variant === "secondary") return "contained";
  return "contained";
}

function resolveColors(variant: AppButtonVariant) {
  if (variant === "secondary") {
    return {
      background: tokens.colors.surfaceVariant,
      border: tokens.colors.surfaceVariant,
      text: tokens.colors.foreground,
    };
  }
  if (variant === "ghost") {
    return {
      background: tokens.colors.surface,
      border: tokens.colors.border,
      text: tokens.colors.foreground,
    };
  }
  if (variant === "danger") {
    return {
      background: tokens.colors.danger,
      border: tokens.colors.danger,
      text: tokens.colors.surface,
    };
  }
  return {
    background: tokens.colors.primary,
    border: tokens.colors.primary,
    text: tokens.colors.surface,
  };
}

export const AppButton = memo(function AppButton({
  accessibilityLabel,
  compact,
  contentStyle,
  disabled,
  fullWidth = true,
  icon,
  label,
  labelStyle,
  loading,
  mode,
  onPress,
  size = "md",
  style,
  testID,
  variant = "primary",
}: AppButtonProps) {
  const isDisabled = !!disabled || !!loading;
  const resolvedMode = resolveMode(mode, variant);
  const resolvedSize = BUTTON_SIZE[size];
  const colors = resolveColors(variant);

  return (
    <Button
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      compact={compact ?? resolvedMode === "text"}
      contentStyle={{
        minHeight: resolvedMode === "text" ? tokens.minHeight.touchTarget : resolvedSize.minHeight,
        paddingHorizontal: resolvedMode === "text" ? 8 : resolvedSize.horizontal,
        ...(contentStyle as object),
      }}
      disabled={isDisabled}
      icon={icon ? () => icon as React.ReactElement : undefined}
      labelStyle={{
        fontSize: resolvedMode === "text" ? 15 : resolvedSize.textSize,
        fontWeight: "700",
        lineHeight: resolvedMode === "text" ? 20 : Math.round(resolvedSize.textSize * 1.35),
        ...(labelStyle as object),
      }}
      loading={loading}
      mode={resolvedMode}
      onPress={onPress}
      buttonColor={resolvedMode === "text" ? undefined : colors.background}
      style={{
        alignSelf: fullWidth ? "stretch" : "flex-start",
        borderRadius: resolvedSize.radius,
        borderWidth: resolvedMode === "outlined" ? 1 : 0,
        borderColor: resolvedMode === "outlined" ? colors.border : "transparent",
        opacity: isDisabled ? 0.55 : 1,
        ...(resolvedMode === "contained" && variant === "primary"
          ? {
              shadowColor: tokens.colors.primaryLight,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
              elevation: 4,
            }
          : {}),
        ...(style as object),
      }}
      testID={testID}
      textColor={resolvedMode === "text" ? tokens.colors.primary : colors.text}
    >
      {label}
    </Button>
  );
});

AppButton.displayName = "AppButton";
