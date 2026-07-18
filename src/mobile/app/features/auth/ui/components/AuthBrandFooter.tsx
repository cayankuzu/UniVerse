import React from "react";
import { Text, View } from "react-native";

type Props = {
  tone?: "dark" | "light";
};

export function AuthBrandFooter({ tone = "light" }: Props) {
  const mutedColor = tone === "dark" ? "rgba(219,234,254,0.75)" : "#94a3b8";
  const strongColor = tone === "dark" ? "rgba(219,234,254,0.95)" : "#475569";

  return (
    <View style={{ alignItems: "center", gap: 2, paddingTop: 12 }}>
      <Text style={{ color: mutedColor, fontSize: 12 }}>Copyright 2026</Text>
      <Text style={{ color: mutedColor, fontSize: 12 }}>
        Powered by <Text style={{ color: strongColor, fontWeight: "700" }}>MeMoDe</Text>
      </Text>
    </View>
  );
}
