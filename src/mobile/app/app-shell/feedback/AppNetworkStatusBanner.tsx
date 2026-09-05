import { WifiOff } from "lucide-react-native";
import React, { useSyncExternalStore } from "react";
import { View } from "react-native";
import { AppText as Text } from "../../shared/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNetworkQuality,
  subscribeNetworkQuality,
} from "../../data/projections/networkAwareBudget";
import { useLiveRegionAnnouncement } from "../../shared/hooks/useLiveRegionAnnouncement";
import { tokens } from "../../shared/theme";

function useNetworkQuality() {
  return useSyncExternalStore(subscribeNetworkQuality, getNetworkQuality, getNetworkQuality);
}

const OFFLINE_TITLE = "Çevrimdışısın";
const OFFLINE_DETAIL = "Kayıtlı içerikleri kullanmaya devam edebilirsin.";

export function AppNetworkStatusBanner() {
  const quality = useNetworkQuality();
  const insets = useSafeAreaInsets();
  const offline = quality === "offline";
  // accessibilityLiveRegion below covers TalkBack; VoiceOver needs this.
  useLiveRegionAnnouncement(offline ? `${OFFLINE_TITLE}. ${OFFLINE_DETAIL}` : null);

  if (!offline) return null;

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
            {OFFLINE_TITLE}
          </Text>
          <Text
            style={{
              color: tokens.colors.warningText,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.medium,
              lineHeight: tokens.lineHeight.caption,
            }}
          >
            {OFFLINE_DETAIL}
          </Text>
        </View>
      </View>
    </View>
  );
}
