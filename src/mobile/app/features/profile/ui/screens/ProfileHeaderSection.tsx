import { useState } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { BookOpen, Cog, GraduationCap, Mail, MapPin } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { TourAnchor } from "../../../../app-shell/onboarding";
import {
  AppImage,
  Avatar,
  ProfileCoverPlaceholder,
  ProfileRoleBadge,
} from "../../../../shared/components";
import { ProfileCategoryChips } from "./ProfileCategoryChips";

type ProfileHeaderUserData = {
  bio?: string;
  categories?: string[];
  coverImage?: string;
  coverImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  } | null;
  department?: string;
  description?: string;
  email?: string;
  followers?: number;
  following?: number;
  gradeYear?: string;
  hideEmail?: boolean;
  profileImage?: string;
  profileImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  } | null;
  university?: string;
  username?: string;
};

interface Props {
  accountType: "club" | "student";
  userData: ProfileHeaderUserData;
  displayName: string;
  onOpenCover: () => void;
  onOpenAvatar: () => void;
  onOpenSettings: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

export function ProfileHeaderSection({
  accountType,
  userData,
  displayName,
  onOpenCover,
  onOpenAvatar,
  onOpenSettings,
  onOpenFollowers,
  onOpenFollowing,
}: Props) {
  const [failedCoverSource, setFailedCoverSource] = useState<string | null>(null);
  const coverFailed = failedCoverSource === userData.coverImage;
  const canShowCover = !!userData.coverImage && !coverFailed;

  return (
    <TourAnchor tourId="profile-header">
      <View style={{ position: "relative", overflow: "visible" }}>
        <Pressable
          accessibilityLabel={t("profile.a11y.cover")}
          accessibilityRole="button"
          onPress={onOpenCover}
          style={{ height: 144, backgroundColor: tokens.colors.border }}
        >
          {canShowCover ? (
            <AppImage
              contentFit="cover"
              onError={() => setFailedCoverSource(userData.coverImage || null)}
              style={{ width: "100%", height: "100%" }}
              uri={userData.coverImage}
              variant="medium"
              variants={userData.coverImageVariants}
            />
          ) : (
            <ProfileCoverPlaceholder accountType={accountType} />
          )}
        </Pressable>

        <View
          style={{
            backgroundColor: tokens.colors.background,
            paddingTop: 42,
            paddingHorizontal: tokens.spacing.sm,
            paddingBottom: tokens.spacing.sm,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: tokens.spacing.xs }}>
            <Text
              style={{
                color: tokens.colors.foreground,
                flexShrink: 1,
                fontSize: tokens.typography.cardTitle,
                fontWeight: tokens.fontWeight.bold,
              }}
            >
              {displayName}
            </Text>
            <ProfileRoleBadge accountType={accountType} />
          </View>

          {userData.username ? (
            <Text
              style={{
                marginTop: tokens.spacing.micro,
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              @{userData.username}
            </Text>
          ) : null}

          {userData.description || userData.bio ? (
            <Text
              style={{
                marginTop: tokens.spacing.xs,
                color: tokens.colors.dark600,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.label,
              }}
            >
              {userData.description || userData.bio}
            </Text>
          ) : null}

          {!userData.hideEmail && userData.email ? (
            <View
              style={{
                marginTop: tokens.spacing.xsMinus,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xxsPlus,
              }}
            >
              <Mail size={tokens.iconSize.xs} color={tokens.colors.textSubtle} />
              <Text
                style={{ color: tokens.colors.textSubtle, fontSize: tokens.typography.caption }}
                numberOfLines={1}
              >
                {userData.email}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              marginTop: tokens.spacing.xs,
              flexDirection: "row",
              gap: tokens.spacing.xsMinus,
              flexWrap: "wrap",
            }}
          >
            {userData.university ? (
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  paddingHorizontal: tokens.spacing.compact,
                  paddingVertical: tokens.spacing.xxsPlus,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xxs,
                }}
              >
                <MapPin size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.semibold,
                  }}
                >
                  {userData.university}
                </Text>
              </View>
            ) : null}
            {userData.department ? (
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  paddingHorizontal: tokens.spacing.compact,
                  paddingVertical: tokens.spacing.xxsPlus,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xxs,
                }}
              >
                <BookOpen size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.semibold,
                  }}
                >
                  {userData.department}
                </Text>
              </View>
            ) : null}
            {userData.gradeYear ? (
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  paddingHorizontal: tokens.spacing.compact,
                  paddingVertical: tokens.spacing.xxsPlus,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xxs,
                }}
              >
                <GraduationCap size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.semibold,
                  }}
                >
                  {userData.gradeYear}
                </Text>
              </View>
            ) : null}
          </View>

          <TourAnchor tourId="profile-stats">
            <View
              style={{ marginTop: tokens.spacing.sm, flexDirection: "row", gap: tokens.spacing.xs }}
            >
              <Pressable
                accessibilityLabel={t("profile.a11y.followers")}
                accessibilityRole="button"
                onPress={onOpenFollowers}
                style={{
                  flex: 1,
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  minHeight: tokens.minHeight.inputSm,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: tokens.spacing.hairline,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.label,
                    fontWeight: tokens.fontWeight.extrabold,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {userData.followers || 0}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {t("profile.stats.followers")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t("profile.a11y.following")}
                accessibilityRole="button"
                onPress={onOpenFollowing}
                style={{
                  flex: 1,
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  minHeight: tokens.minHeight.inputSm,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: tokens.spacing.hairline,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.label,
                    fontWeight: tokens.fontWeight.extrabold,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {userData.following || 0}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.caption,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {t("profile.stats.following")}
                </Text>
              </Pressable>
            </View>
          </TourAnchor>

          <ProfileCategoryChips accountType={accountType} categories={userData.categories} />
        </View>

        <TourAnchor
          tourId="settings-button"
          style={{
            position: "absolute",
            top: tokens.spacing.sm,
            right: tokens.spacing.sm,
            zIndex: 70,
            elevation: 14,
          }}
        >
          <Pressable
            accessibilityLabel={t("profile.a11y.settings")}
            accessibilityRole="button"
            hitSlop={tokens.hitSlop.sm}
            onPress={onOpenSettings}
            style={{
              width: tokens.minHeight.touchTarget,
              height: tokens.minHeight.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
            testID="profile-settings-button"
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: withAlpha(tokens.colors.surface, 0.92),
                borderColor: withAlpha(tokens.colors.foreground, 0.1),
                borderRadius: tokens.radius.card,
                borderWidth: 1,
                height: 32,
                justifyContent: "center",
                width: 32,
              }}
            >
              <Cog size={tokens.iconSize.md} color={tokens.colors.textSecondary} />
            </View>
          </Pressable>
        </TourAnchor>

        <View
          style={{
            position: "absolute",
            left: tokens.spacing.sm,
            top: 108,
            zIndex: 65,
            elevation: 12,
          }}
        >
          <Pressable
            accessibilityLabel={t("profile.a11y.avatar")}
            accessibilityRole="button"
            onPress={onOpenAvatar}
          >
            <Avatar
              borderColor={tokens.colors.background}
              borderWidth={4}
              name={displayName}
              size={72}
              uri={userData.profileImage}
              variants={userData.profileImageVariants}
            />
          </Pressable>
        </View>
      </View>
    </TourAnchor>
  );
}
