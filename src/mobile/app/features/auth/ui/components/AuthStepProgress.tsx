import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AuthStepProgressProps {
  total: number;
  current: number;
  colors: readonly [string, string, ...string[]];
}

export function AuthStepProgress({ total, current, colors }: AuthStepProgressProps) {
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i < current;
        return (
          <View key={i} style={{ flex: 1, borderRadius: 999, overflow: "hidden" }}>
            {active ? (
              <LinearGradient colors={colors} style={{ height: 4 }} />
            ) : (
              <View style={{ height: 4, backgroundColor: "#e2e8f0" }} />
            )}
          </View>
        );
      })}
    </View>
  );
}
