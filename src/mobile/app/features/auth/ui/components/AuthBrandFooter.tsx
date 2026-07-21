import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";

type Props = {
  tone?: "dark" | "light";
};

export function AuthBrandFooter({ tone = "light" }: Props) {
  const mutedColor =
    tone === "dark" ? withAlpha(tokens.colors.primarySoft, 0.75) : tokens.colors.textSubtle;
  const strongColor =
    tone === "dark" ? withAlpha(tokens.colors.primarySoft, 0.95) : tokens.colors.textSecondary;

  return (
    <View
      style={{ alignItems: "center", gap: tokens.spacing.hairline, paddingTop: tokens.spacing.xs }}
    >
      <Text style={{ color: mutedColor, fontSize: tokens.typography.caption }}>Copyright 2026</Text>
      <Text style={{ color: mutedColor, fontSize: tokens.typography.caption }}>
        Powered by <Text style={{ color: strongColor, fontWeight: "700" }}>MeMoDe</Text>
      </Text>
    </View>
  );
}
