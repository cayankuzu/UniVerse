import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import { tokens } from "../../../../shared/theme";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function EventFormSection({ title, subtitle, children }: Props) {
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <View style={{ gap: tokens.spacing.xsMinus }}>
        <View
          style={{
            width: 46,
            height: 4,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.primaryBorder,
          }}
        />
        <Text
          style={{
            fontSize: tokens.typography.title,
            fontWeight: tokens.fontWeight.extrabold,
            color: tokens.colors.foreground,
            letterSpacing: tokens.letterSpacing.label,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: tokens.typography.body,
              color: tokens.colors.muted,
              fontWeight: tokens.fontWeight.medium,
              lineHeight: tokens.lineHeight.body,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          backgroundColor: tokens.colors.surface,
          borderRadius: tokens.radius.xl,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          padding: tokens.spacing.md,
          gap: tokens.spacing.sm,
          ...tokens.shadow.sm,
        }}
      >
        {children}
      </View>
    </View>
  );
}
