import { useState } from "react";
import { BookOpen, Cog, GraduationCap, ImageIcon, Mail, MapPin } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { TourAnchor } from "../../../../app-shell/onboarding";
import { AppImage, Avatar } from "../../../../shared/components";

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
  userData: ProfileHeaderUserData;
  displayName: string;
  onOpenCover: () => void;
  onOpenAvatar: () => void;
  onOpenSettings: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

export function ProfileHeaderSection({
  userData,
  displayName,
  onOpenCover,
  onOpenAvatar,
  onOpenSettings,
  onOpenFollowers,
  onOpenFollowing,
}: Props) {
  const [coverFailed, setCoverFailed] = useState(false);
  const canShowCover = !!userData.coverImage && !coverFailed;

  return (
    <TourAnchor tourId="profile-header">
      <View style={{ position: "relative", overflow: "visible" }}>
        <Pressable
          accessibilityLabel={t("profile.a11y.cover")}
          accessibilityRole="button"
          onPress={onOpenCover}
          style={{ height: 176, backgroundColor: tokens.colors.border }}
        >
          {canShowCover ? (
            <AppImage
              contentFit="cover"
              onError={() => setCoverFailed(true)}
              onLoad={() => setCoverFailed(false)}
              style={{ width: "100%", height: "100%" }}
              uri={userData.coverImage}
              variant="medium"
              variants={userData.coverImageVariants}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ImageIcon size={32} color={tokens.colors.mutedFg} />
            </View>
          )}
        </Pressable>

        <View
          style={{
            backgroundColor: tokens.colors.background,
            paddingTop: 50,
            paddingHorizontal: tokens.spacing.sm,
            paddingBottom: tokens.spacing.sm,
          }}
        >
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.subtitle + 2,
              fontWeight: tokens.fontWeight.bold,
            }}
          >
            {displayName}
          </Text>

          {userData.username ? (
            <Text
              style={{
                marginTop: 2,
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              @{userData.username}
            </Text>
          ) : null}

          {!userData.hideEmail && userData.email ? (
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Mail size={tokens.iconSize.xs} color={tokens.colors.mutedFg} />
              <Text
                style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}
                numberOfLines={1}
              >
                {userData.email}
              </Text>
            </View>
          ) : null}

          {userData.description || userData.bio ? (
            <Text
              style={{
                marginTop: tokens.spacing.xs,
                color: tokens.colors.dark600,
                fontSize: tokens.typography.caption,
                lineHeight: 18,
              }}
            >
              {userData.description || userData.bio}
            </Text>
          ) : null}

          <View
            style={{ marginTop: tokens.spacing.xs, flexDirection: "row", gap: 6, flexWrap: "wrap" }}
          >
            {userData.university ? (
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MapPin size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.tiny,
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
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <BookOpen size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.tiny,
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
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <GraduationCap size={tokens.iconSize.xs} color={tokens.colors.muted} />
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.tiny,
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
                  gap: 1,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: 13,
                    fontWeight: tokens.fontWeight.extrabold,
                  }}
                >
                  {userData.followers || 0}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.micro,
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
                  gap: 1,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: 13,
                    fontWeight: tokens.fontWeight.extrabold,
                  }}
                >
                  {userData.following || 0}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.micro,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {t("profile.stats.following")}
                </Text>
              </Pressable>
            </View>
          </TourAnchor>

          {userData.categories?.length ? (
            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {userData.categories.slice(0, 10).map((category) => (
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
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(15,23,42,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
            testID="profile-settings-button"
          >
            <Cog size={tokens.iconSize.md} color={tokens.colors.surface} />
          </Pressable>
        </TourAnchor>

        <View
          style={{
            position: "absolute",
            left: tokens.spacing.sm,
            top: 132,
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
              size={88}
              uri={userData.profileImage}
              variants={userData.profileImageVariants}
            />
          </Pressable>
        </View>
      </View>
    </TourAnchor>
  );
}
