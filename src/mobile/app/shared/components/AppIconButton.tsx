import { memo, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { Badge, Surface, TouchableRipple } from "react-native-paper";
import { tokens } from "../../shared/theme";

interface AppIconButtonProps {
  accessibilityLabel?: string;
  badgeContent?: number | string | null;
  disabled?: boolean;
  icon: (props: { color: string; size: number }) => ReactNode;
  iconColor?: string;
  iconSize?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  outlineColor?: string;
  selected?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  surfaceColor?: string;
  testID?: string;
}

function normalizeBadgeContent(value?: number | string | null) {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  if (typeof value === "number" && value > 99) return "99+";
  return String(value);
}

export const AppIconButton = memo(function AppIconButton({
  accessibilityLabel,
  badgeContent,
  disabled = false,
  icon,
  iconColor,
  iconSize,
  onPress,
  onPressIn,
  outlineColor,
  selected = false,
  size = 36,
  style,
  surfaceColor,
  testID,
}: AppIconButtonProps) {
  const resolvedBadge = normalizeBadgeContent(badgeContent);
  const resolvedIconSize = iconSize ?? Math.max(16, Math.round(size * 0.48));
  const resolvedSurfaceColor =
    surfaceColor ?? (selected ? tokens.colors.accent : tokens.colors.surfaceVariant);
  const resolvedOutlineColor = outlineColor ?? tokens.colors.divider;
  const resolvedIconColor = iconColor ?? (selected ? tokens.colors.primary : tokens.colors.muted);
  const targetSize = Math.max(tokens.minHeight.touchTarget, size);
  const badgeOffset = Math.max(0, Math.round((targetSize - size) / 2) - 2);

  return (
    <View
      style={[
        {
          width: targetSize,
          height: targetSize,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Surface
        elevation={0}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: resolvedSurfaceColor,
          borderWidth: 1,
          borderColor: resolvedOutlineColor,
        }}
      >
        <TouchableRipple
          accessibilityLabel={accessibilityLabel || "Eylem"}
          accessibilityRole="button"
          accessibilityState={{ disabled, selected }}
          borderless={false}
          disabled={disabled}
          onPress={onPress}
          onPressIn={onPressIn}
          rippleColor={tokens.colors.divider}
          style={{ flex: 1, borderRadius: size / 2 }}
          testID={testID}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {icon({ color: resolvedIconColor, size: resolvedIconSize })}
          </View>
        </TouchableRipple>
      </Surface>

      {resolvedBadge ? (
        <Badge
          style={{
            position: "absolute",
            top: badgeOffset,
            right: badgeOffset,
            backgroundColor: tokens.colors.danger,
            color: tokens.colors.surface,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
          }}
        >
          {resolvedBadge}
        </Badge>
      ) : null}
    </View>
  );
});

AppIconButton.displayName = "AppIconButton";
