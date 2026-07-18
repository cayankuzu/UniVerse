import React from "react";
import { Text, View } from "react-native";
import type { SettingsActionCardData, SettingsSectionData } from "./settingsScreen.shared";
import { SettingsActionCard } from "./SettingsActionCard";

const COLORS = {
  muted: "#64748b",
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
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: COLORS.muted,
          fontSize: 12,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {section.label}
      </Text>

      {section.items.map((item) => (
        <SettingsActionCard
          key={item.key}
          borderColor={item.borderColor}
          chevronColor={item.chevronColor}
          disabled={item.disabled}
          iconBackgroundColor={item.iconBackgroundColor}
          iconColor={item.iconColor}
          Icon={item.Icon}
          onPress={() => onPressItem(item)}
          subtitle={item.subtitle}
          subtitleColor={item.subtitleColor}
          title={item.title}
          titleColor={item.titleColor}
        />
      ))}
    </View>
  );
});
