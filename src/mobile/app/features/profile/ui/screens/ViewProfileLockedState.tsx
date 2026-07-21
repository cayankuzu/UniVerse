import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { View } from "react-native";
import { Ban, Flag, Lock } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { Avatar, BackHeader, GradientButton } from "../../../../shared/components";
import type { UserProfile } from "../../application/profileUiModels";
import { ViewProfileStats } from "./ViewProfileStats";

type BlockedProps = {
  onBack: () => void;
  onReport: () => void;
  onUnblock: () => void;
  profile?: UserProfile | null;
  displayName?: string;
  username: string;
};

export function ViewProfileBlockedState({
  onBack,
  onReport,
  onUnblock,
  profile,
  displayName,
  username,
}: BlockedProps) {
  const resolvedName = displayName || profile?.clubName || profile?.name || username;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }} edges={["bottom"]}>
      <BackHeader title={`@${username}`} onBack={onBack} />
      <View
        style={{ flex: 1, paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.smPlus }}
      >
        <View
          style={{
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.surface,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            padding: tokens.spacing.lg,
            alignItems: "center",
          }}
        >
          <Avatar
            borderColor={tokens.colors.background}
            borderWidth={3}
            name={resolvedName}
            size={72}
            uri={String(profile?.profileImage || "")}
          />
          <Text
            style={{
              marginTop: tokens.spacing.smPlus,
              color: tokens.colors.foreground,
              fontSize: tokens.typography.sectionTitle,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {resolvedName}
          </Text>
          <Text
            style={{
              marginTop: tokens.spacing.xxs,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            @{username}
          </Text>
          {profile?.university ? (
            <Text
              style={{
                marginTop: tokens.spacing.xs,
                color: tokens.colors.muted,
                fontSize: tokens.typography.label,
                textAlign: "center",
                lineHeight: tokens.lineHeight.body,
              }}
            >
              {profile.university}
            </Text>
          ) : null}

          <ViewProfileStats accountType={profile?.accountType} disableActions profile={profile} />

          <View
            style={{
              marginTop: tokens.spacing.mdPlus,
              width: "100%",
              borderRadius: tokens.radius.control,
              borderWidth: 1,
              borderColor: tokens.colors.dangerBorder,
              backgroundColor: tokens.colors.dangerSoft,
              paddingHorizontal: tokens.spacing.smPlus,
              paddingVertical: tokens.spacing.smPlus,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: tokens.spacing.compact,
            }}
          >
            <Ban
              size={tokens.iconSize.lg}
              color={tokens.colors.danger}
              style={{ marginTop: tokens.spacing.hairline }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: tokens.colors.danger,
                  fontSize: tokens.typography.body,
                  fontWeight: tokens.fontWeight.extrabold,
                }}
              >
                {t("viewProfile.blocked.title")}
              </Text>
              <Text
                style={{
                  marginTop: tokens.spacing.xxs,
                  color: tokens.colors.dangerDeep,
                  fontSize: tokens.typography.caption,
                  lineHeight: tokens.lineHeight.label,
                }}
              >
                {t("viewProfile.blocked.subtitle")}
              </Text>
            </View>
          </View>

          <View style={{ width: "100%", marginTop: tokens.spacing.md, gap: tokens.spacing.xs }}>
            <GradientButton
              label={t("viewProfile.blocked.unblock")}
              onPress={onUnblock}
              variant="secondary"
            />
            <GradientButton
              icon={<Flag size={tokens.iconSize.md} color={tokens.colors.foreground} />}
              label={t("viewProfile.blocked.report")}
              onPress={onReport}
              variant="ghost"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

type LockedProps = {
  accountType: "student" | "club";
  contentLockedMessage: string;
  displayName: string;
  followLabel: string;
  followLoading: boolean;
  followVariant: "primary" | "ghost" | "secondary";
  onFollowPress: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  profile: UserProfile | null | undefined;
  isOwnProfile: boolean;
};

export function ViewProfileLockedState({
  accountType,
  contentLockedMessage,
  displayName,
  followLabel,
  followLoading,
  followVariant,
  onFollowPress,
  onOpenFollowers,
  onOpenFollowing,
  profile,
  isOwnProfile,
}: LockedProps) {
  return (
    <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.smPlus }}>
      <View
        style={{
          borderRadius: tokens.radius.lg,
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          padding: tokens.spacing.lg,
          alignItems: "center",
        }}
      >
        {profile ? (
          <>
            <Avatar
              borderColor={tokens.colors.background}
              borderWidth={3}
              name={displayName}
              size={72}
              uri={profile.profileImage || ""}
            />
            <Text
              style={{
                marginTop: tokens.spacing.smPlus,
                color: tokens.colors.foreground,
                fontSize: tokens.typography.sectionTitle,
                fontWeight: tokens.fontWeight.extrabold,
              }}
            >
              {displayName}
            </Text>
            <Text
              style={{
                marginTop: tokens.spacing.xxs,
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              @{profile.username}
            </Text>
            {profile.university ? (
              <Text
                style={{
                  marginTop: tokens.spacing.xs,
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.label,
                  textAlign: "center",
                  lineHeight: tokens.lineHeight.body,
                }}
              >
                {profile.university}
              </Text>
            ) : null}
            <ViewProfileStats
              accountType={profile?.accountType || accountType}
              onOpenFollowers={onOpenFollowers}
              onOpenFollowing={onOpenFollowing}
              profile={profile}
            />
          </>
        ) : null}
        <Lock size={tokens.iconSize["2xl"]} color={tokens.colors.warningIcon} />
        <Text
          style={{
            marginTop: tokens.spacing.sm,
            color: tokens.colors.foreground,
            fontSize: tokens.typography.subtitle + 2,
            fontWeight: tokens.fontWeight.extrabold,
          }}
        >
          {t("viewProfile.locked.title")}
        </Text>
        <Text
          style={{
            marginTop: tokens.spacing.xsMinus,
            color: tokens.colors.muted,
            fontSize: tokens.typography.label,
            lineHeight: tokens.lineHeight.body,
            textAlign: "center",
          }}
        >
          {contentLockedMessage}
        </Text>
        {!isOwnProfile ? (
          <View style={{ width: "100%", marginTop: tokens.spacing.smPlus, gap: tokens.spacing.xs }}>
            <GradientButton
              accessibilityLabel={t("viewProfile.a11y.follow")}
              label={followLabel}
              loading={followLoading}
              onPress={onFollowPress}
              variant={followVariant}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
