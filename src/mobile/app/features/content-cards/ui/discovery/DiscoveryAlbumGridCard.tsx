import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image as ImageIcon, Play } from "lucide-react-native";
import { AppImage } from "../../../../shared/components/AppImage";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import { OwnerRow, VisibilityChip } from "./DiscoveryGridCardPrimitives";
import { DISCOVERY_GRID_CARD_COLORS, resolveAlbumUniversity } from "./discoveryCardTokens";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { tokens } from "../../../../shared/theme";

type ImageVariants = {
  full?: string | null;
  medium?: string | null;
  thumbnail?: string | null;
};

type AlbumGridCardItem = {
  id: string;
  caption?: string | null;
  eventId?: string | null;
  image?: string | null;
  imageVariants?: ImageVariants | null;
  images?: unknown[];
  name?: string | null;
  photoCount?: number | null;
  title?: string | null;
  university?: string | null;
  userImage?: string | null;
  userUniversity?: string | null;
  username?: string | null;
};

function resolveAlbumMediaUris(item: AlbumGridCardItem, leadImage: string) {
  const mediaUris = Array.isArray(item.images)
    ? item.images.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (leadImage && !mediaUris.includes(leadImage)) {
    mediaUris.unshift(leadImage);
  }
  return Array.from(new Set(mediaUris));
}

interface DiscoveryAlbumGridCardProps {
  item: AlbumGridCardItem;
  onPress: (albumId: string) => void;
  cardWidth: number;
  cardHeight: number;
  mediaHeight: number;
  showOwner?: boolean;
  onPrefetchEvent?: (eventId: string) => void;
  visibility: {
    label?: string;
    text?: string;
    type: "club" | "own";
  };
}

export const DiscoveryAlbumGridCard = React.memo(function DiscoveryAlbumGridCard({
  item,
  onPress,
  cardWidth,
  cardHeight: _cardHeight,
  mediaHeight,
  showOwner = true,
  onPrefetchEvent,
  visibility,
}: DiscoveryAlbumGridCardProps) {
  const [failedMediaUris, setFailedMediaUris] = useState<Set<string>>(() => new Set());
  const resolvedImage = String(item.image || "").trim();
  const mediaUris = useMemo(
    () => resolveAlbumMediaUris(item, resolvedImage),
    [item, resolvedImage],
  );
  const mediaKey = mediaUris.join("|");
  const leadMediaUri = mediaUris[0] || resolvedImage;
  const isLeadImage = leadMediaUri === resolvedImage;
  const leadMediaFailed = leadMediaUri ? failedMediaUris.has(leadMediaUri) : false;
  const mediaCounts = useMemo(() => {
    const candidates = mediaUris;
    let photoItems = 0;
    let videoItems = 0;
    candidates.forEach((uri) => {
      if (isVideoMediaUri(uri)) {
        videoItems += 1;
        return;
      }
      photoItems += 1;
    });
    if (candidates.length === 0 && Number(item.photoCount || 0) > 0) {
      photoItems = Math.max(Number(item.photoCount || 0), 1);
    }
    if (Number(item.photoCount || 0) > candidates.length && videoItems === 0) {
      photoItems = Math.max(Number(item.photoCount || 0), 1);
    }
    return { photoItems, videoItems };
  }, [item.photoCount, mediaUris]);
  const ownerName = String(item.name || item.username || "Kullanıcı");
  const ownerUniversity = resolveAlbumUniversity(item);
  const safeMediaHeight = Math.max(104, Math.min(mediaHeight, Math.floor(cardWidth * 0.84)));
  const visibilityLabel = String(visibility.label || visibility.text || "").trim();

  useEffect(() => {
    setFailedMediaUris(new Set());
  }, [item.id, mediaKey]);

  return (
    <Pressable
      style={{
        width: cardWidth,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.08)",
        backgroundColor: DISCOVERY_GRID_CARD_COLORS.surface,
        overflow: "hidden",
        paddingBottom: tokens.spacing.xs,
      }}
      onPressIn={() => {
        const eventId = String(item.eventId || "").trim();
        if (!eventId) return;
        onPrefetchEvent?.(eventId);
      }}
      onPress={() => onPress(item.id)}
    >
      {showOwner ? (
        <OwnerRow image={item.userImage || ""} name={ownerName} university={ownerUniversity} />
      ) : null}

      <View
        style={{
          marginTop: showOwner ? 6 : 0,
          width: "100%",
          height: safeMediaHeight,
          backgroundColor: DISCOVERY_GRID_CARD_COLORS.border,
          position: "relative",
        }}
      >
        {leadMediaUri && !leadMediaFailed ? (
          isVideoMediaUri(leadMediaUri) ? (
            <View style={{ width: "100%", height: safeMediaHeight }}>
              <VideoThumbnailPreview
                candidateUris={
                  isLeadImage
                    ? [
                        item.imageVariants?.thumbnail,
                        item.imageVariants?.medium,
                        item.imageVariants?.full,
                      ]
                    : undefined
                }
                uri={leadMediaUri}
                priority="eager"
                style={{ width: "100%", height: "100%" }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(15,23,42,0.18)",
                }}
              >
                <Play size={24} color={tokens.colors.surface} strokeWidth={1.8} />
              </View>
            </View>
          ) : (
            <AppImage
              uri={leadMediaUri}
              variants={isLeadImage ? item.imageVariants : undefined}
              variant="thumbnail"
              style={{ width: "100%", height: safeMediaHeight }}
              onError={() => {
                setFailedMediaUris((current) => new Set(current).add(leadMediaUri));
              }}
            />
          )
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ImageIcon size={tokens.iconSize.xl} color={tokens.colors.mutedFg} />
          </View>
        )}
        {mediaCounts.photoItems > 0 || mediaCounts.videoItems > 0 ? (
          <View style={{ position: "absolute", top: tokens.spacing.xxs, left: tokens.spacing.xxs }}>
            <View
              style={{
                borderRadius: tokens.radius.pill,
                paddingHorizontal: 7,
                paddingVertical: 2,
                backgroundColor: "rgba(15,23,42,0.7)",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {mediaCounts.photoItems > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <ImageIcon size={8} color={tokens.colors.surface} />
                  <Text
                    style={{
                      color: tokens.colors.surface,
                      fontSize: 8,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {mediaCounts.photoItems}
                  </Text>
                </View>
              ) : null}
              {mediaCounts.videoItems > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Play size={8} color={tokens.colors.surface} fill={tokens.colors.surface} />
                  <Text
                    style={{
                      color: tokens.colors.surface,
                      fontSize: 8,
                      fontWeight: tokens.fontWeight.bold,
                    }}
                  >
                    {mediaCounts.videoItems}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <Text
        style={{
          marginTop: 6,
          paddingHorizontal: tokens.spacing.xs,
          color: DISCOVERY_GRID_CARD_COLORS.text,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
          lineHeight: 15,
        }}
        numberOfLines={2}
      >
        {item.title || ""}
      </Text>
      {item.caption ? (
        <Text
          style={{
            marginTop: 2,
            paddingHorizontal: tokens.spacing.xs,
            color: DISCOVERY_GRID_CARD_COLORS.muted,
            fontSize: tokens.typography.micro,
            lineHeight: 13,
          }}
          numberOfLines={1}
        >
          {item.caption}
        </Text>
      ) : null}
      <VisibilityChip type={visibility.type} label={`Görünürlük: ${visibilityLabel}`} />
    </Pressable>
  );
});
