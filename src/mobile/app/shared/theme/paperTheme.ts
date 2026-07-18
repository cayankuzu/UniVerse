import { MD3LightTheme, type MD3Theme } from "react-native-paper";
import { tokens } from "./tokens";

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: tokens.radius.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: tokens.colors.primary,
    secondary: tokens.colors.secondary,
    tertiary: tokens.colors.accent,
    error: tokens.colors.danger,
    background: tokens.colors.background,
    surface: tokens.colors.surface,
    surfaceVariant: tokens.colors.surfaceVariant,
    surfaceDisabled: tokens.colors.surfaceVariant,
    secondaryContainer: tokens.colors.mutedSurface,
    tertiaryContainer: tokens.colors.warningSurface,
    errorContainer: tokens.colors.dangerSurface,
    onPrimary: tokens.colors.surface,
    onSecondary: tokens.colors.foreground,
    onSecondaryContainer: tokens.colors.primaryDark,
    onBackground: tokens.colors.text,
    onSurface: tokens.colors.text,
    onSurfaceVariant: tokens.colors.muted,
    onTertiaryContainer: tokens.colors.warning,
    onErrorContainer: tokens.colors.danger,
    outline: tokens.colors.border,
    outlineVariant: tokens.colors.divider,
    shadow: tokens.colors.shadow,
    backdrop: tokens.colors.overlay,
  },
};
