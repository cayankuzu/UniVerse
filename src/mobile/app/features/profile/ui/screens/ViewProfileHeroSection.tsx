import { BookOpen, GraduationCap, Mail, MapPin } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { AppImage, Avatar, GradientButton } from "../../../../shared/components";
import type { UserProfile } from "../../application/profileUiModels";
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
          style={{ height: 176, backgroundColor: tokens.colors.border }}
        >
          {profile.coverImage ? (
            <AppImage
              uri={profile.coverImage}
              variants={profile.coverImageVariants}
              variant="medium"
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
        </Pressable>
        <View style={{ position: "absolute", left: tokens.spacing.sm, bottom: -48, zIndex: 4 }}>
          <Pressable
            accessibilityLabel={t("viewProfile.a11y.avatar")}
            accessibilityRole="button"
            onPress={onOpenAvatar}
          >
            <Avatar
              uri={profile.profileImage}
              variants={profile.profileImageVariants}
              name={displayName}
              size={96}
              borderWidth={4}
              borderColor={tokens.colors.surface}
            />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          backgroundColor: tokens.colors.surface,
          paddingTop: 58,
          paddingHorizontal: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
        }}
      >
        <Text
          style={{
            color: tokens.colors.foreground,
            fontSize: tokens.typography.sectionTitle,
            fontWeight: tokens.fontWeight.extrabold,
          }}
        >
          {displayName}
        </Text>
        {profile.username ? (
          <Text
            style={{
              marginTop: 2,
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            @{profile.username}
          </Text>
        ) : null}
        {!profile.hideEmail && profile.email ? (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Mail size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text
              style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}
              numberOfLines={1}
            >
              {profile.email}
            </Text>
          </View>
        ) : null}

        {profile.bio || profile.description ? (
          <Text
            style={{
              marginTop: tokens.spacing.xs,
              color: tokens.colors.dark600,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {profile.bio || profile.description}
          </Text>
        ) : null}

        {profile.university ? (
          <View
            style={{
              marginTop: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <MapPin size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.university}
            </Text>
          </View>
        ) : null}
        {profile.department ? (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <BookOpen size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.department}
            </Text>
          </View>
        ) : null}
        {profile.gradeYear ? (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <GraduationCap size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {profile.gradeYear}
            </Text>
          </View>
        ) : null}

        {!isOwnProfile ? (
          <View style={{ marginTop: 10 }}>
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

        {Array.isArray(profile.categories) && profile.categories.length > 0 ? (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {profile.categories
              .slice(0, 10)
              .filter(Boolean)
              .map((category: string) => (
                <View
                  key={category}
                  style={{
                    borderRadius: tokens.radius.sm,
                    backgroundColor: tokens.colors.primarySofter,
                    paddingHorizontal: tokens.spacing.xs,
                    paddingVertical: 5,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.primary,
                      fontSize: tokens.typography.tiny,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {category}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
      </View>
    </>
  );
}
