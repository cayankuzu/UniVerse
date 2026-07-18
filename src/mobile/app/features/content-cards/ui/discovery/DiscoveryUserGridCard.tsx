import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image as ImageIcon } from "lucide-react-native";
import { AppImage } from "../../../../shared/components/AppImage";
import { Avatar } from "../../../../shared/components/Avatar";
import {
  OverflowActionMenu,
  type OverflowActionItem,
} from "../../../../shared/components/OverflowActionMenu";
import { DISCOVERY_GRID_CARD_COLORS } from "./discoveryCardTokens";
import { tokens } from "../../../../shared/theme";

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
  menuTitle = "Profil Islemleri",
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
  const detailParts = [
    String(item.department || looseItem.department || "").trim(),
    String(
      item.year || looseItem.gradeYear || looseItem.gradeyear || looseItem.grade_year || "",
    ).trim(),
    String(
      item.category ||
        (Array.isArray(item.categories) ? item.categories[0] : "") ||
        looseItem.category ||
        (Array.isArray(looseItem.categories) ? looseItem.categories[0] : "") ||
        "",
    ).trim(),
  ].filter(Boolean);
  const metaLine = [resolvedUniversity || "Üniversite bilgisi yok", ...detailParts].join(" | ");
  const [coverFailed, setCoverFailed] = useState(false);
  const canShowCover = !!coverSource && !coverFailed;
  const bioText = String(
    looseItem.bio || looseItem.description || looseItem.about || looseItem.biography || "",
  ).trim();
  const avatarSize = Math.max(52, Math.min(66, Math.floor(cardWidth * 0.36)));
  const coverHeight = Math.max(64, Math.min(84, Math.floor(avatarSize * 1.2)));
  const contentTopPadding = Math.floor(avatarSize / 2) + 2;

  useEffect(() => {
    setCoverFailed(false);
  }, [item.id, coverSource]);

  return (
    <View style={{ width: cardWidth, position: "relative" }}>
      <Pressable
        style={{
          width: "100%",
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: "rgba(15,23,42,0.08)",
          backgroundColor: DISCOVERY_GRID_CARD_COLORS.surface,
          overflow: "hidden",
          paddingBottom: 6,
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
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ImageIcon size={tokens.iconSize.xl} color={tokens.colors.mutedFg} />
            </View>
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
          <Text
            style={{
              color: DISCOVERY_GRID_CARD_COLORS.text,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
              lineHeight: 15,
            }}
            numberOfLines={1}
          >
            {resolvedName}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: DISCOVERY_GRID_CARD_COLORS.muted,
              fontSize: tokens.typography.micro,
              lineHeight: 13,
            }}
            numberOfLines={1}
          >
            {metaLine}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: DISCOVERY_GRID_CARD_COLORS.muted,
              fontSize: tokens.typography.micro,
              lineHeight: tokens.typography.caption,
            }}
            numberOfLines={2}
          >
            {bioText || "Biyografi yok"}
          </Text>
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
