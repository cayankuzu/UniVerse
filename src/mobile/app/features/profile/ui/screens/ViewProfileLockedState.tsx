import React from "react";
import { Text, View } from "react-native";
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
      <View style={{ flex: 1, paddingHorizontal: tokens.spacing.md, paddingTop: 14 }}>
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
            size={88}
            uri={String(profile?.profileImage || "")}
          />
          <Text
            style={{
              marginTop: 14,
              color: tokens.colors.foreground,
              fontSize: tokens.typography.sectionTitle,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {resolvedName}
          </Text>
          <Text
            style={{
              marginTop: 4,
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
                fontSize: 13,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {profile.university}
            </Text>
          ) : null}

          <ViewProfileStats accountType={profile?.accountType} disableActions profile={profile} />

          <View
            style={{
              marginTop: 18,
              width: "100%",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.colors.dangerBorder,
              backgroundColor: tokens.colors.dangerSoft,
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Ban size={tokens.iconSize.lg} color={tokens.colors.danger} style={{ marginTop: 1 }} />
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
                  marginTop: 4,
                  color: tokens.colors.dangerDeep,
                  fontSize: tokens.typography.caption,
                  lineHeight: 18,
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
    <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: 14 }}>
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
              size={88}
              uri={profile.profileImage || ""}
            />
            <Text
              style={{
                marginTop: 14,
                color: tokens.colors.foreground,
                fontSize: tokens.typography.sectionTitle,
                fontWeight: tokens.fontWeight.extrabold,
              }}
            >
              {displayName}
            </Text>
            <Text
              style={{
                marginTop: 4,
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
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 20,
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
            marginTop: 6,
            color: tokens.colors.muted,
            fontSize: 13,
            lineHeight: 20,
            textAlign: "center",
          }}
        >
          {contentLockedMessage}
        </Text>
        {!isOwnProfile ? (
          <View style={{ width: "100%", marginTop: 14, gap: tokens.spacing.xs }}>
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
