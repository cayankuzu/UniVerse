import React, { type ReactNode, useEffect, useState } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { Calendar } from "lucide-react-native";
import { AppImage } from "../../../../shared/components/AppImage";
import { AccessChip, OwnerRow } from "./DiscoveryGridCardPrimitives";
import { DISCOVERY_GRID_CARD_COLORS } from "./discoveryCardTokens";
import { tokens, withAlpha } from "../../../../shared/theme";

type ImageVariants = {
  full?: string | null;
  medium?: string | null;
  thumbnail?: string | null;
};

type EventGridCardItem = {
  club?: string | null;
  clubImage?: string | null;
  clubUsername?: string | null;
  description?: string | null;
  id: string;
  image?: string | null;
  imageVariants?: ImageVariants | null;
  title?: string | null;
  university?: string | null;
};

interface DiscoveryEventGridCardProps {
  access: {
    kind: "general" | "members_only" | "public";
    label: string;
  };
  item: EventGridCardItem;
  onPress: (eventId: string) => void;
  cardWidth: number;
  cardHeight: number;
  mediaHeight: number;
  showOwner?: boolean;
  onPrefetchEvent?: (eventId: string) => void;
  pendingOverlay?: ReactNode;
  disablePress?: boolean;
}

export const DiscoveryEventGridCard = React.memo(function DiscoveryEventGridCard({
  access,
  item,
  onPress,
  cardWidth,
  cardHeight: _cardHeight,
  mediaHeight,
  showOwner = true,
  onPrefetchEvent,
  pendingOverlay,
  disablePress = false,
}: DiscoveryEventGridCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedImage = String(item.image || "").trim();
  const canShowImage = !!resolvedImage && !imageFailed;
  const ownerName = String(item.club || item.clubUsername || "Kulüp");
  const ownerUniversity = String(item.university || "Üniversite bilgisi yok");
  const safeMediaHeight = Math.max(104, Math.min(mediaHeight, Math.floor(cardWidth * 0.84)));

  useEffect(() => {
    setImageFailed(false);
  }, [item.id, item.image]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${String(item.title || "Etkinlik")} etkinliğini aç`}
      accessibilityState={{ disabled: disablePress }}
      style={{
        width: cardWidth,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.08),
        backgroundColor: DISCOVERY_GRID_CARD_COLORS.surface,
        overflow: "hidden",
        paddingBottom: tokens.spacing.xs,
      }}
      onPressIn={() => {
        if (disablePress) return;
        const eventId = String(item.id || "").trim();
        if (!eventId) return;
        onPrefetchEvent?.(eventId);
      }}
      onPress={() => {
        if (disablePress) return;
        onPress(item.id);
      }}
    >
      {showOwner ? (
        <OwnerRow image={item.clubImage || ""} name={ownerName} university={ownerUniversity} />
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
        {canShowImage ? (
          <AppImage
            uri={resolvedImage}
            variants={item.imageVariants}
            variant="thumbnail"
            style={{ width: "100%", height: "100%" }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Calendar size={tokens.iconSize.xl} color={tokens.colors.mutedFg} />
          </View>
        )}
      </View>

      <Text
        style={{
          marginTop: tokens.spacing.xsMinus,
          paddingHorizontal: tokens.spacing.xs,
          color: DISCOVERY_GRID_CARD_COLORS.text,
          fontSize: tokens.typography.caption,
          fontWeight: tokens.fontWeight.bold,
          lineHeight: tokens.lineHeight.tiny,
        }}
        numberOfLines={2}
      >
        {item.title || ""}
      </Text>
      <AccessChip kind={access.kind} label={`Erişim: ${access.label}`} />
      {pendingOverlay}
    </Pressable>
  );
});
