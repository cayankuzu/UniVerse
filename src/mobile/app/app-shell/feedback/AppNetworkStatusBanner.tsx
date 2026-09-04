import { WifiOff } from "lucide-react-native";
import React, { useSyncExternalStore } from "react";
import { View } from "react-native";
import { AppText as Text } from "../../shared/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNetworkQuality,
  subscribeNetworkQuality,
} from "../../data/projections/networkAwareBudget";
import { tokens } from "../../shared/theme";

function useNetworkQuality() {
  return useSyncExternalStore(subscribeNetworkQuality, getNetworkQuality, getNetworkQuality);
}

export function AppNetworkStatusBanner() {
  const quality = useNetworkQuality();
  const insets = useSafeAreaInsets();

  if (quality !== "offline") return null;

  return (
    <View
      pointerEvents="none"
      style={{
        left: tokens.spacing.sm,
        position: "absolute",
        right: tokens.spacing.sm,
        top: insets.top + tokens.spacing.xs,
        zIndex: 40,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        accessible
        style={{
          alignItems: "center",
          backgroundColor: tokens.colors.warningSurface,
          borderColor: tokens.colors.warningBorder,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          flexDirection: "row",
          gap: tokens.spacing.xs,
          minHeight: tokens.minHeight.row,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: tokens.spacing.xs,
          ...tokens.shadow.sm,
        }}
      >
        <WifiOff color={tokens.colors.warningIcon} size={tokens.iconSize.lg} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: tokens.colors.warningText,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            Çevrimdışısın
          </Text>
          <Text
            style={{
              color: tokens.colors.warningText,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.medium,
              lineHeight: tokens.lineHeight.caption,
            }}
          >
            Kayıtlı içerikleri kullanmaya devam edebilirsin.
          </Text>
        </View>
      </View>
    </View>
  );
}
