import React, { memo } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { tokens } from "../../shared/theme";
import { triggerHapticFeedback, type AppHapticFeedback } from "../feedback/haptics";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type AppButtonSize = "sm" | "md" | "lg";

export interface AppButtonProps {
  accessibilityLabel?: string;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  haptic?: AppHapticFeedback;
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
  lg: {
    horizontal: tokens.spacing.smPlus,
    minHeight: tokens.minHeight.buttonLg,
    radius: tokens.radius.lg,
    textSize: tokens.typography.control,
  },
  md: {
    horizontal: tokens.spacing.md,
    minHeight: tokens.minHeight.buttonMd,
    radius: tokens.radius.md,
    textSize: tokens.typography.body,
  },
  sm: {
    horizontal: tokens.spacing.sm,
    minHeight: tokens.minHeight.buttonSm,
    radius: tokens.radius.sm,
    textSize: tokens.typography.label,
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
  if (variant === "success") {
    return {
      background: tokens.colors.success,
      border: tokens.colors.success,
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
  haptic,
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
      accessibilityState={{ busy: Boolean(loading), disabled: isDisabled }}
      compact={compact ?? resolvedMode === "text"}
      contentStyle={{
        minHeight: resolvedMode === "text" ? tokens.minHeight.buttonSm : resolvedSize.minHeight,
        paddingHorizontal: resolvedMode === "text" ? tokens.spacing.xs : resolvedSize.horizontal,
        ...(contentStyle as object),
      }}
      disabled={isDisabled}
      hitSlop={resolvedMode === "text" ? tokens.hitSlop.sm : undefined}
      icon={icon ? () => icon as React.ReactElement : undefined}
      labelStyle={{
        fontSize: resolvedMode === "text" ? tokens.typography.control : resolvedSize.textSize,
        fontWeight: tokens.fontWeight.bold,
        lineHeight:
          resolvedMode === "text"
            ? tokens.lineHeight.control
            : Math.round(resolvedSize.textSize * 1.35),
        ...(labelStyle as object),
      }}
      loading={loading}
      mode={resolvedMode}
      onPress={
        onPress
          ? () => {
              if (haptic) triggerHapticFeedback(haptic);
              onPress();
            }
          : undefined
      }
      buttonColor={resolvedMode === "text" ? undefined : colors.background}
      style={{
        alignSelf: fullWidth ? "stretch" : "flex-start",
        borderRadius: resolvedSize.radius,
        borderWidth: resolvedMode === "outlined" ? 1 : 0,
        borderColor: resolvedMode === "outlined" ? colors.border : "transparent",
        opacity: isDisabled ? tokens.opacity.disabled : 1,
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
