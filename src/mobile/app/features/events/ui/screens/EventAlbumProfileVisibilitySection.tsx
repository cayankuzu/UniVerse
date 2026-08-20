import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
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
      accessibilityLabel={props.title}
      accessibilityRole="switch"
      accessibilityState={{ checked: props.selected, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        borderColor: props.selected ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: props.selected ? tokens.colors.primarySoft : tokens.colors.surface,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.sm,
        minHeight: tokens.minHeight.row,
        flexDirection: "row",
        gap: tokens.spacing.sm,
        alignItems: "center",
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: tokens.spacing.micro }}>
        <Text
          style={{
            color: tokens.colors.text,
            fontSize: tokens.typography.label,
            fontWeight: "700",
          }}
        >
          {props.title}
        </Text>
        <Text
          style={{
            color: tokens.colors.muted,
            fontSize: tokens.typography.tiny,
            lineHeight: tokens.lineHeight.compact,
          }}
        >
          {props.description}
        </Text>
      </View>
      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: tokens.radius.pill,
          backgroundColor: props.selected ? tokens.colors.primary : tokens.colors.mutedFg,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.microPlus,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: tokens.radius.pill,
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
    <View style={{ gap: tokens.spacing.xs }}>
      <Text
        style={{ color: tokens.colors.text, fontSize: tokens.typography.label, fontWeight: "700" }}
      >
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
