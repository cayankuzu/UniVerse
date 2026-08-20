import { BookOpen, GraduationCap, Mail, MapPin } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import {
  AppImage,
  Avatar,
  GradientButton,
  ProfileCoverPlaceholder,
  ProfileRoleBadge,
} from "../../../../shared/components";
import type { UserProfile } from "../../application/profileUiModels";
import { ProfileCategoryChips } from "./ProfileCategoryChips";
import { ViewProfileStats } from "./ViewProfileStats";

interface ViewProfileHeroSectionProps {
  disableStatsActions: boolean;
  displayName: string;
  followLabel: string;
  followVariant: "primary" | "ghost" | "secondary";
  isOwnProfile: boolean;
  onFollowPress: () => void;
  onOpenAvatar: () => void;
  onOpenCover: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  profile: UserProfile;
}

export function ViewProfileHeroSection({
  disableStatsActions,
  displayName,
  followLabel,
  followVariant,
  isOwnProfile,
  onFollowPress,
  onOpenAvatar,
  onOpenCover,
  onOpenFollowers,
  onOpenFollowing,
  profile,
}: ViewProfileHeroSectionProps) {
  return (
    <>
      <View style={{ position: "relative", overflow: "visible" }}>
        <Pressable
          accessibilityLabel={t("viewProfile.a11y.cover")}
          accessibilityRole="button"
          onPress={onOpenCover}
          style={{ height: 144, backgroundColor: tokens.colors.border }}
        >
          {profile.coverImage ? (
            <AppImage
              uri={profile.coverImage}
              variants={profile.coverImageVariants}
              variant="medium"
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <ProfileCoverPlaceholder accountType={profile.accountType} />
          )}
        </Pressable>
        <View style={{ position: "absolute", left: tokens.spacing.sm, bottom: -40, zIndex: 4 }}>
          <Pressable
            accessibilityLabel={t("viewProfile.a11y.avatar")}
            accessibilityRole="button"
            onPress={onOpenAvatar}
          >
            <Avatar
              uri={profile.profileImage}
              variants={profile.profileImageVariants}
              name={displayName}
              size={80}
              borderWidth={4}
              borderColor={tokens.colors.surface}
            />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          backgroundColor: tokens.colors.surface,
          paddingTop: 48,
          paddingHorizontal: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: tokens.spacing.xs }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              flexShrink: 1,
              fontSize: tokens.typography.sectionTitle,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {displayName}
          </Text>
          <ProfileRoleBadge accountType={profile.accountType} />
        </View>
        {profile.username ? (
          <Text
            style={{
              marginTop: tokens.spacing.micro,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            @{profile.username}
          </Text>
        ) : null}
        {profile.bio || profile.description ? (
          <Text
            style={{
              marginTop: tokens.spacing.xs,
              color: tokens.colors.dark600,
              fontSize: tokens.typography.label,
              lineHeight: tokens.lineHeight.bodyCompact,
            }}
          >
            {profile.bio || profile.description}
          </Text>
        ) : null}

        {!profile.hideEmail && profile.email ? (
          <View
            style={{
              marginTop: tokens.spacing.xsMinus,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <Mail size={tokens.iconSize.xs} color={tokens.colors.textSubtle} />
            <Text
              style={{ color: tokens.colors.textSubtle, fontSize: tokens.typography.caption }}
              numberOfLines={1}
            >
              {profile.email}
            </Text>
          </View>
        ) : null}

        {profile.university ? (
          <View
            style={{
              marginTop: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <MapPin size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.university}
            </Text>
          </View>
        ) : null}
        {profile.department ? (
          <View
            style={{
              marginTop: tokens.spacing.xsMinus,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <BookOpen size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.department}
            </Text>
          </View>
        ) : null}
        {profile.gradeYear ? (
          <View
            style={{
              marginTop: tokens.spacing.xsMinus,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <GraduationCap size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.gradeYear}
            </Text>
          </View>
        ) : null}

        {!isOwnProfile ? (
          <View style={{ marginTop: tokens.spacing.compact }}>
            <GradientButton
              accessibilityLabel={t("viewProfile.a11y.follow")}
              label={followLabel}
              onPress={onFollowPress}
              size="sm"
              variant={followVariant}
            />
          </View>
        ) : null}

        <ViewProfileStats
          accountType={profile.accountType}
          disableActions={disableStatsActions}
          onOpenFollowers={onOpenFollowers}
          onOpenFollowing={onOpenFollowing}
          profile={profile}
        />

        <ProfileCategoryChips accountType={profile.accountType} categories={profile.categories} />
      </View>
    </>
  );
}
