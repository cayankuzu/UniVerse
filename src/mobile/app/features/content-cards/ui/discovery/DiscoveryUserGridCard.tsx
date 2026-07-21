import React, { useState } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { AppImage } from "../../../../shared/components/AppImage";
import { Avatar } from "../../../../shared/components/Avatar";
import { ProfileCoverPlaceholder } from "../../../../shared/components/ProfileIdentity";
import {
  OverflowActionMenu,
  type OverflowActionItem,
} from "../../../../shared/components/OverflowActionMenu";
import { DISCOVERY_GRID_CARD_COLORS } from "./discoveryCardTokens";
import { tokens, withAlpha } from "../../../../shared/theme";
import { formatTurkishDisplayText } from "../../../../shared/i18n/turkishDisplay";

type ImageVariants = {
  full?: string | null;
  medium?: string | null;
  thumbnail?: string | null;
};

type SearchUserGridCardItem = {
  accountType?: "club" | "student";
  bio?: string;
  categories?: string[];
  category?: string;
  coverImage?: string;
  coverImageVariants?: ImageVariants;
  createdAt?: string;
  department?: string;
  description?: string;
  id: string;
  image: string;
  imageVariants?: ImageVariants;
  isPrivate: boolean;
  name: string;
  university: string;
  username: string;
  year?: string;
} & {
  about?: string;
  biography?: string;
  club_name?: string;
  clubname?: string;
  cover_image?: string;
  cover_image_path?: string;
  coverimage?: string;
  grade_year?: string;
  gradeYear?: string;
  gradeyear?: string;
  profileImage?: string;
  profile_image?: string;
  profile_image_path?: string;
  profileimage?: string;
};

interface DiscoveryUserGridCardProps {
  item: SearchUserGridCardItem;
  onPress: (item: SearchUserGridCardItem) => void;
  cardWidth: number;
  cardHeight: number;
  mediaHeight: number;
  menuActions?: OverflowActionItem[];
  menuTitle?: string;
  onPrefetchProfile?: (username: string) => void;
}

export const DiscoveryUserGridCard = React.memo(function DiscoveryUserGridCard({
  item,
  onPress,
  cardWidth,
  cardHeight: _cardHeight,
  mediaHeight: _mediaHeight,
  menuActions = [],
  menuTitle = "Profil İşlemleri",
  onPrefetchProfile,
}: DiscoveryUserGridCardProps) {
  const looseItem = item;
  const resolvedUsername = String(item.username || "").trim();
  const resolvedName = String(
    item.name || looseItem.club_name || looseItem.clubname || resolvedUsername || "Kullanıcı",
  ).trim();
  const avatarSource = String(
    item.image ||
      looseItem.profileImage ||
      looseItem.profileimage ||
      looseItem.profile_image ||
      looseItem.profile_image_path ||
      "",
  ).trim();
  const coverSource = String(
    item.coverImage ||
      looseItem.coverimage ||
      looseItem.cover_image ||
      looseItem.cover_image_path ||
      "",
  ).trim();
  const resolvedUniversity = String(item.university || "").trim();
  const accountType = item.accountType === "club" ? "club" : "student";
  const department = String(item.department || looseItem.department || "").trim();
  const year = String(
    item.year || looseItem.gradeYear || looseItem.gradeyear || looseItem.grade_year || "",
  ).trim();
  const primaryCategory = String(
    item.category ||
      (Array.isArray(item.categories) ? item.categories[0] : "") ||
      looseItem.category ||
      (Array.isArray(looseItem.categories) ? looseItem.categories[0] : "") ||
      "",
  ).trim();
  const metaLine = (
    accountType === "club"
      ? [resolvedUniversity, formatTurkishDisplayText(primaryCategory)]
      : [resolvedUniversity, department, year]
  )
    .filter(Boolean)
    .join(" • ");
  const [failedCoverSource, setFailedCoverSource] = useState<string | null>(null);
  const coverFailed = failedCoverSource === coverSource;
  const canShowCover = !!coverSource && !coverFailed;
  const bioText = String(
    looseItem.bio || looseItem.description || looseItem.about || looseItem.biography || "",
  ).trim();
  const avatarSize = Math.max(52, Math.min(66, Math.floor(cardWidth * 0.36)));
  const coverHeight = Math.max(64, Math.min(84, Math.floor(avatarSize * 1.2)));
  const contentTopPadding = Math.floor(avatarSize / 2) + 2;

  return (
    <View style={{ width: cardWidth, position: "relative" }}>
      <Pressable
        style={{
          width: "100%",
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: withAlpha(tokens.colors.foreground, 0.08),
          backgroundColor: DISCOVERY_GRID_CARD_COLORS.surface,
          overflow: "hidden",
          paddingBottom: tokens.spacing.xsMinus,
        }}
        onPressIn={() => {
          if (!resolvedUsername) return;
          onPrefetchProfile?.(resolvedUsername);
        }}
        onPress={() => onPress(item)}
      >
        <View
          style={{
            width: "100%",
            height: coverHeight,
            justifyContent: "center",
            backgroundColor: DISCOVERY_GRID_CARD_COLORS.border,
          }}
        >
          {canShowCover ? (
            <AppImage
              uri={coverSource}
              variants={item.coverImageVariants}
              variant="medium"
              style={{ width: "100%", height: "100%" }}
              onError={() => setFailedCoverSource(coverSource)}
            />
          ) : (
            <ProfileCoverPlaceholder accountType={accountType} />
          )}
        </View>

        <View
          style={{
            position: "absolute",
            left: tokens.spacing.xs,
            top: coverHeight - Math.floor(avatarSize / 2),
          }}
        >
          <Avatar
            uri={avatarSource}
            variants={item.imageVariants}
            name={resolvedName}
            size={avatarSize}
            borderWidth={2}
            borderColor={tokens.colors.surface}
          />
        </View>

        <View style={{ paddingTop: contentTopPadding, paddingHorizontal: tokens.spacing.xs }}>
          <View style={{ alignItems: "center", flexDirection: "row" }}>
            <Text
              style={{
                color: DISCOVERY_GRID_CARD_COLORS.text,
                flexShrink: 1,
                fontSize: tokens.typography.body,
                fontWeight: tokens.fontWeight.bold,
                lineHeight: tokens.lineHeight.body,
              }}
              numberOfLines={1}
            >
              {resolvedName}
            </Text>
          </View>
          {metaLine ? (
            <Text
              style={{
                marginTop: tokens.spacing.micro,
                color: DISCOVERY_GRID_CARD_COLORS.muted,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.compact,
              }}
              numberOfLines={2}
            >
              {metaLine}
            </Text>
          ) : null}
          {bioText ? (
            <Text
              style={{
                marginTop: tokens.spacing.micro,
                color: DISCOVERY_GRID_CARD_COLORS.muted,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.compact,
              }}
              numberOfLines={2}
            >
              {bioText}
            </Text>
          ) : (
            <View style={{ minHeight: tokens.lineHeight.compact }} />
          )}
        </View>
      </Pressable>

      {menuActions.length > 0 ? (
        <View style={{ position: "absolute", top: tokens.spacing.xs, right: tokens.spacing.xs }}>
          <OverflowActionMenu actions={menuActions} title={menuTitle} buttonSize={28} />
        </View>
      ) : null}
    </View>
  );
});
