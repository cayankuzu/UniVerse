import React, { memo, useEffect, useMemo, useRef } from "react";
import { Home, PlusCircle, Search, User, type LucideIcon } from "lucide-react-native";
import { Animated, StyleSheet, View } from "react-native";
import { Surface } from "react-native-paper";
import { AppText as Text } from "../../../shared/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../../shared/theme";
import { t } from "../../../shared/i18n";
import { useReducedMotion } from "../../../shared/hooks/useReducedMotion";
import { InstantPressable } from "../../../shared/components/InstantPressable";
import { TourAnchor } from "../../onboarding";

type TabKey = "home" | "search" | "create" | "profile";

interface Props {
  active: TabKey;
  visible?: boolean;
  accountType?: string;
  onHome: () => void;
  onSearch: () => void;
  onProfile: () => void;
  onCreate?: () => void;
  onIntent?: (tab: "profile" | "search") => void;
}

interface Tab {
  key: TabKey;
  onPress: () => void;
}

const TAB_LABELS: Record<TabKey, () => string> = {
  home: () => t("nav.home"),
  search: () => t("nav.search"),
  create: () => t("nav.create"),
  profile: () => t("nav.profile"),
};

const TAB_ICONS: Record<TabKey, LucideIcon> = {
  home: Home,
  search: Search,
  create: PlusCircle,
  profile: User,
};

const TOUR_TAB_IDS: Record<TabKey, string> = {
  home: "bottom-nav-home",
  search: "bottom-nav-search",
  create: "bottom-nav-create",
  profile: "bottom-nav-profile",
};

function renderTabIcon(tabKey: TabKey, isActive: boolean) {
  const Icon = TAB_ICONS[tabKey];
  return (
    <Icon
      color={isActive ? tokens.colors.primary : tokens.colors.iconMuted}
      size={tabKey === "create" ? tokens.iconSize["2xl"] : tokens.iconSize.xl}
      strokeWidth={isActive ? 2 : 1.5}
    />
  );
}

export const MainBottomTabs = memo(function MainBottomTabs({
  active,
  visible = true,
  accountType = "student",
  onHome,
  onSearch,
  onProfile,
  onCreate,
  onIntent,
}: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const visibilityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      visibilityAnim.setValue(visible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(visibilityAnim, {
      toValue: visible ? 1 : 0,
      duration: tokens.duration.fast,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, visibilityAnim, visible]);

  const tabs = useMemo<Tab[]>(
    () => [
      { key: "home", onPress: onHome },
      { key: "search", onPress: onSearch },
      ...(accountType === "club" && onCreate
        ? [{ key: "create" as const, onPress: onCreate }]
        : []),
      { key: "profile", onPress: onProfile },
    ],
    [accountType, onCreate, onHome, onProfile, onSearch],
  );
  const tabTranslateY = visibilityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        opacity: visibilityAnim,
        transform: [{ translateY: tabTranslateY }],
      }}
    >
      <TourAnchor tourId="bottom-nav">
        <Surface
          elevation={2}
          style={{
            marginHorizontal: 0,
            marginBottom: 0,
            borderTopLeftRadius: tokens.radius.lg,
            borderTopRightRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.surface,
            borderWidth: 1,
            borderColor: tokens.colors.divider,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: tokens.spacing.xsMinus,
            paddingTop: tokens.spacing.xsMinus,
            paddingBottom: Math.max(insets.bottom + tokens.spacing.xs, tokens.spacing.sm),
            shadowColor: tokens.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            const intentTab = tab.key === "profile" || tab.key === "search" ? tab.key : null;
            const tabButton = (
              <InstantPressable
                accessibilityLabel={TAB_LABELS[tab.key]()}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                haptic="selection"
                onPress={tab.onPress}
                onPressIn={intentTab ? () => onIntent?.(intentTab) : undefined}
                style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
              >
                {isActive ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      width: tokens.iconSize.xl,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: tokens.colors.primary,
                    }}
                  />
                ) : null}
                {renderTabIcon(tab.key, isActive)}
                <Text
                  numberOfLines={2}
                  style={{
                    color: isActive ? tokens.colors.primary : tokens.colors.iconMuted,
                    fontSize: tokens.typography.tiny,
                    fontWeight: isActive ? tokens.fontWeight.bold : tokens.fontWeight.medium,
                    lineHeight: tokens.lineHeight.nano,
                    textAlign: "center",
                  }}
                >
                  {TAB_LABELS[tab.key]()}
                </Text>
              </InstantPressable>
            );
            return (
              <TourAnchor
                key={`${tab.key}-anchor`}
                tourId={TOUR_TAB_IDS[tab.key]}
                style={{ flex: 1 }}
              >
                {tabButton}
              </TourAnchor>
            );
          })}
        </Surface>
      </TourAnchor>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  tabButton: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.microPlus,
    justifyContent: "center",
    minHeight: tokens.minHeight.touchTarget,
    paddingHorizontal: tokens.spacing.micro,
  },
  tabButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
});
