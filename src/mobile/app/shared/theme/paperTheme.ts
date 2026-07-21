import { configureFonts, MD3LightTheme, type MD3Theme } from "react-native-paper";
import { tokens } from "./tokens";

const fontConfig = {
  bodyLarge: {
    fontFamily: tokens.fontFamily.regular,
    fontSize: tokens.typography.body,
    lineHeight: tokens.lineHeight.bodyRelaxed,
  },
  bodyMedium: {
    fontFamily: tokens.fontFamily.regular,
    fontSize: tokens.typography.label,
    lineHeight: tokens.lineHeight.label,
  },
  bodySmall: {
    fontFamily: tokens.fontFamily.regular,
    fontSize: tokens.typography.caption,
    lineHeight: tokens.lineHeight.caption,
  },
  displayLarge: {
    fontFamily: tokens.fontFamily.extrabold,
    fontSize: tokens.typography.hero,
    lineHeight: tokens.lineHeight.hero,
  },
  displayMedium: {
    fontFamily: tokens.fontFamily.extrabold,
    fontSize: tokens.typography.displayLarge,
    lineHeight: tokens.lineHeight.display,
  },
  displaySmall: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.display,
    lineHeight: tokens.lineHeight.display,
  },
  headlineLarge: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.heading,
    lineHeight: tokens.lineHeight.heading,
  },
  headlineMedium: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.title,
    lineHeight: tokens.lineHeight.title,
  },
  headlineSmall: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.sectionTitle,
    lineHeight: tokens.lineHeight.sectionTitle,
  },
  labelLarge: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.control,
    lineHeight: tokens.lineHeight.control,
  },
  labelMedium: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.label,
    lineHeight: tokens.lineHeight.label,
  },
  labelSmall: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.caption,
    lineHeight: tokens.lineHeight.caption,
  },
  titleLarge: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.cardTitle,
    lineHeight: tokens.lineHeight.cardTitle,
  },
  titleMedium: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.header,
    lineHeight: tokens.lineHeight.header,
  },
  titleSmall: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.subtitle,
    lineHeight: tokens.lineHeight.subtitle,
  },
} as const;

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
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
