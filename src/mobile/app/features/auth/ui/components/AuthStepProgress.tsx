import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tokens } from "../../../../shared/theme";

interface AuthStepProgressProps {
  total: number;
  current: number;
  colors: readonly [string, string, ...string[]];
}

export function AuthStepProgress({ total, current, colors }: AuthStepProgressProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: tokens.spacing.xsMinus,
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: tokens.spacing.sm,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const active = i < current;
        return (
          <View key={i} style={{ flex: 1, borderRadius: tokens.radius.pill, overflow: "hidden" }}>
            {active ? (
              <LinearGradient colors={colors} style={{ height: 4 }} />
            ) : (
              <View style={{ height: 4, backgroundColor: tokens.colors.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}
