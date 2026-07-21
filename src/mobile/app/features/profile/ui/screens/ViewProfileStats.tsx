import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

type Props = {
  accountType?: "student" | "club" | string | null;
  disableActions?: boolean;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  profile?: {
    followersCount?: number | null;
    followingCount?: number | null;
  } | null;
};

function StatChip({
  accessibilityLabel,
  count,
  disabled = false,
  label,
  onPress,
}: {
  accessibilityLabel?: string;
  count: number;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.label,
          fontWeight: tokens.fontWeight.extrabold,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </>
  );

  if (disabled || !onPress) {
    return (
      <View
        style={{
          minWidth: 80,
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.colors.background,
          paddingHorizontal: tokens.spacing.smPlus,
          paddingVertical: tokens.spacing.compact,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minWidth: 80,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.colors.background,
        paddingHorizontal: tokens.spacing.smPlus,
        paddingVertical: tokens.spacing.compact,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {content}
    </Pressable>
  );
}

export function ViewProfileStats({
  disableActions = false,
  onOpenFollowers,
  onOpenFollowing,
  profile,
}: Props) {
  const stats = [
    {
      count: Number(profile?.followersCount || 0),
      disabled: disableActions,
      key: "followers",
      label: t("profile.stats.followers"),
      accessibilityLabel: t("viewProfile.a11y.followers"),
      onPress: onOpenFollowers,
    },
    {
      count: Number(profile?.followingCount || 0),
      disabled: disableActions,
      key: "following",
      label: t("profile.stats.following"),
      accessibilityLabel: t("viewProfile.a11y.following"),
      onPress: onOpenFollowing,
    },
  ];

  return (
    <View
      style={{
        marginTop: tokens.spacing.smPlus,
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.spacing.xs,
      }}
    >
      {stats.map((item) => (
        <StatChip
          accessibilityLabel={item.accessibilityLabel}
          count={item.count}
          disabled={item.disabled}
          key={item.key}
          label={item.label}
          onPress={item.onPress}
        />
      ))}
    </View>
  );
}
