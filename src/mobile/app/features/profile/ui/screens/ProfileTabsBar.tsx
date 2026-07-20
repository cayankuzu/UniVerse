import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { tokens } from "../../../../shared/theme";
import { TourAnchor } from "../../../../app-shell/onboarding";
import type { ProfileTab } from "../../domain/profileConstants";

interface TabItem {
  key: ProfileTab;
  label: string;
  count: number;
}

interface Props {
  tab: ProfileTab;
  tabs: TabItem[];
  onChange: (next: ProfileTab) => void;
  expandableTab?: ProfileTab;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function ProfileTabsBar({
  tab,
  tabs,
  onChange,
  expandableTab,
  expanded = false,
  onToggleExpanded,
}: Props) {
  return (
    <TourAnchor tourId="profile-tabs">
      <View
        style={{
          marginHorizontal: 0,
          marginTop: tokens.spacing.xs,
          borderRadius: 14,
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: "rgba(15,23,42,0.08)",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        {tabs.map((item) => {
          const active = tab === item.key;
          const isExpandable = item.key === expandableTab;
          const Indicator = active && expanded ? ChevronDown : ChevronRight;
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => {
                if (active && isExpandable && onToggleExpanded) {
                  onToggleExpanded();
                  return;
                }
                onChange(item.key);
              }}
              style={{
                flex: 1,
                minHeight: tokens.minHeight.touchTarget,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                position: "relative",
              }}
            >
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.mutedFg,
                  fontSize: tokens.typography.micro,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {item.label}
              </Text>
              {isExpandable ? (
                <Indicator
                  size={tokens.iconSize.xs}
                  color={active ? tokens.colors.primary : tokens.colors.mutedFg}
                />
              ) : null}
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: active
                    ? tokens.colors.primarySoft
                    : tokens.colors.surfaceVariant,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: active ? tokens.colors.primary : tokens.colors.mutedFg,
                    fontSize: tokens.typography.nano,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {item.count}
                </Text>
              </View>
              {active ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "25%",
                    right: "25%",
                    height: 2,
                    borderRadius: tokens.radius.pill,
                    backgroundColor: tokens.colors.primary,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </TourAnchor>
  );
}
