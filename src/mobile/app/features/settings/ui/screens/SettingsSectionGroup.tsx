import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import type { SettingsActionCardData, SettingsSectionData } from "./settingsScreen.shared";
import { SettingsActionCard } from "./SettingsActionCard";
import { tokens } from "../../../../shared/theme";

const COLORS = {
  muted: tokens.colors.muted,
} as const;

type Props = {
  onPressItem: (item: SettingsActionCardData) => void;
  section: SettingsSectionData;
};

export const SettingsSectionGroup = React.memo(function SettingsSectionGroup({
  onPressItem,
  section,
}: Props) {
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text
        style={{
          color: COLORS.muted,
          fontSize: tokens.typography.caption,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: tokens.letterSpacing.section,
        }}
      >
        {section.label}
      </Text>

      <View
        style={{
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.control,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        {section.items.map((item, index) => (
          <SettingsActionCard
            key={item.key}
            borderColor={item.borderColor}
            chevronColor={item.chevronColor}
            disabled={item.disabled}
            groupPosition={
              section.items.length === 1
                ? "only"
                : index === 0
                  ? "first"
                  : index === section.items.length - 1
                    ? "last"
                    : "middle"
            }
            iconBackgroundColor={item.iconBackgroundColor}
            iconColor={item.iconColor}
            Icon={item.Icon}
            onPress={() => onPressItem(item)}
            separated={item.action === "delete-account"}
            subtitle={item.subtitle}
            subtitleColor={item.subtitleColor}
            title={item.title}
            titleColor={item.titleColor}
          />
        ))}
      </View>
    </View>
  );
});
