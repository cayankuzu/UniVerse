import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
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
          borderRadius: tokens.radius.control,
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: withAlpha(tokens.colors.foreground, 0.08),
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
                minHeight: tokens.minHeight.chipLg,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: tokens.spacing.xsMinus,
                position: "relative",
              }}
            >
              <Text
                style={{
                  color: active ? tokens.colors.primary : tokens.colors.mutedFg,
                  fontSize: tokens.typography.caption,
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
                  paddingHorizontal: tokens.spacing.xsMinus,
                  paddingVertical: tokens.spacing.micro,
                }}
              >
                <Text
                  style={{
                    color: active ? tokens.colors.primary : tokens.colors.mutedFg,
                    fontSize: tokens.typography.caption,
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
