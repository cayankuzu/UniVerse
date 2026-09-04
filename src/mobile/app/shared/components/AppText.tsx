import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text as NativeText,
  type TextProps as NativeTextProps,
  type TextStyle,
} from "react-native";
import { tokens } from "../theme";

export type AppTextVariant =
  "hero" | "pageTitle" | "sectionTitle" | "cardTitle" | "body" | "label" | "meta" | "badge";

export type AppTextProps = NativeTextProps & {
  variant?: AppTextVariant;
};

const variantStyles: Record<AppTextVariant, TextStyle> = {
  hero: {
    fontFamily: tokens.fontFamily.extrabold,
    fontSize: tokens.typography.hero,
    lineHeight: tokens.lineHeight.hero,
  },
  pageTitle: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.heading,
    lineHeight: tokens.lineHeight.heading,
  },
  sectionTitle: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.sectionTitle,
    lineHeight: tokens.lineHeight.sectionTitle,
  },
  cardTitle: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.cardTitle,
    lineHeight: tokens.lineHeight.cardTitle,
  },
  body: {
    fontFamily: tokens.fontFamily.regular,
    fontSize: tokens.typography.body,
    lineHeight: tokens.lineHeight.body,
  },
  label: {
    fontFamily: tokens.fontFamily.semibold,
    fontSize: tokens.typography.label,
    lineHeight: tokens.lineHeight.label,
  },
  meta: {
    fontFamily: tokens.fontFamily.medium,
    fontSize: tokens.typography.caption,
    lineHeight: tokens.lineHeight.compact,
  },
  badge: {
    fontFamily: tokens.fontFamily.bold,
    fontSize: tokens.typography.caption,
    lineHeight: tokens.lineHeight.caption,
  },
};

function resolveFontFamily(style: NativeTextProps["style"]) {
  const flattened = StyleSheet.flatten(style) || {};
  const weight = String(flattened.fontWeight || "400");
  if (weight === "800" || weight === "900") return tokens.fontFamily.extrabold;
  if (weight === "700" || weight === "bold") return tokens.fontFamily.bold;
  if (weight === "600") return tokens.fontFamily.semibold;
  if (weight === "500") return tokens.fontFamily.medium;
  return tokens.fontFamily.regular;
}

export const AppText = forwardRef<React.ComponentRef<typeof NativeText>, AppTextProps>(
  function AppText({ maxFontSizeMultiplier = 2, style, variant, ...props }, ref) {
    const variantStyle = variant ? variantStyles[variant] : undefined;
    const fontFamily = variantStyle?.fontFamily || resolveFontFamily(style);
    return (
      <NativeText
        {...props}
        ref={ref}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[variantStyle, style, { fontFamily }]}
      />
    );
  },
);

AppText.displayName = "AppText";

export function getAppTextVariantStyle(variant: AppTextVariant) {
  return variantStyles[variant];
}
