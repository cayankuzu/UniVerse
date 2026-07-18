import React from "react";
import { Pressable, Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

type Props = {
  accountType: "club" | "student";
  disabled?: boolean;
  onChangeShowOnClubProfile: (value: boolean) => void;
  onChangeShowOnOwnProfile: (value: boolean) => void;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
};

function VisibilityOptionRow(props: {
  description: string;
  disabled?: boolean;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: props.selected, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: props.selected ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: props.selected ? tokens.colors.primarySoft : tokens.colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 12,
        minHeight: tokens.minHeight.touchTarget,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700" }}>
          {props.title}
        </Text>
        <Text style={{ color: tokens.colors.muted, fontSize: 11, lineHeight: 16 }}>
          {props.description}
        </Text>
      </View>
      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          backgroundColor: props.selected ? tokens.colors.primary : tokens.colors.mutedFg,
          justifyContent: "center",
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: tokens.colors.surface,
            alignSelf: props.selected ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}

export function EventAlbumProfileVisibilitySection(props: Props) {
  if (props.accountType === "club") {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700" }}>
        {t("profile.visibility.title")}
      </Text>
      <VisibilityOptionRow
        description={t("profile.visibility.ownProfileHint")}
        disabled={props.disabled}
        onPress={() => props.onChangeShowOnOwnProfile(!props.showOnOwnProfile)}
        selected={props.showOnOwnProfile}
        title={t("profile.visibility.ownProfile")}
      />
      <VisibilityOptionRow
        description={t("profile.visibility.clubProfileHint")}
        disabled={props.disabled}
        onPress={() => props.onChangeShowOnClubProfile(!props.showOnClubProfile)}
        selected={props.showOnClubProfile}
        title={t("profile.visibility.clubProfile")}
      />
    </View>
  );
}
