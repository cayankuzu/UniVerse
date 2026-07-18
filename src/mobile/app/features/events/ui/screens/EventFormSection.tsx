import React from "react";
import { Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function EventFormSection({ title, subtitle, children }: Props) {
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <View style={{ gap: 6 }}>
        <View
          style={{
            width: 56,
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
            letterSpacing: 0.1,
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
              lineHeight: 20,
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
