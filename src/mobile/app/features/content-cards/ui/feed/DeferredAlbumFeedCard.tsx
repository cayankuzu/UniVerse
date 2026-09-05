import { memo, useCallback } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Play } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppImage } from "../../../../shared/components";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import { useDeferredAlbumFeedCardState } from "../../application/useDeferredAlbumFeedCardState";
import {
  AlbumCardDetails,
  AlbumCardHeaderSection,
  AlbumCardSurface,
  type AlbumFeedCardProps,
} from "./AlbumFeedCard.shared";
import { AlbumCardFooter } from "./AlbumCardFooter";
import { tokens, withAlpha } from "../../../../shared/theme";

export const DeferredAlbumFeedCard = memo(function DeferredAlbumFeedCard({
  photo,
  currentUsername,
  imageVariant = "thumbnail",
  presentation,
  relations,
  onOpenComments,
  onOpenEvent,
  onOpenClub,
  onOpenLikes,
  onOpenProfile,
  onShowWarning,
  context = "feed",
  hideEventAction = false,
  highPriority = false,
  isTourTarget = false,
  onOpenCard,
  viewer,
  renderTourAnchor,
}: AlbumFeedCardProps) {
  const photoCount = Math.max(
    Number(presentation?.photoCount || photo.photoCount || photo.images?.length || 1),
    1,
  );
  const state = useDeferredAlbumFeedCardState({
    context,
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    ownerId: viewer.id,
    photo,
    relations,
  });
  const heroImageUri = String(photo.image || photo.images?.[0] || "").trim() || undefined;
  const handleOpenCard = useCallback(() => {
    onOpenCard?.(String(photo.eventId || photo.id));
  }, [onOpenCard, photo.eventId, photo.id]);
  const handleOpenComments = useCallback(() => {
    if (onOpenComments) {
      onOpenComments();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenComments]);
  const handleOpenLikes = useCallback(() => {
    if (onOpenLikes) {
      onOpenLikes();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenLikes]);

  return (
    <AlbumCardSurface isTourTarget={isTourTarget} renderTourAnchor={renderTourAnchor}>
      <AlbumCardHeaderSection
        photo={photo}
        presentation={presentation}
        onOpenProfile={onOpenProfile}
      />

      <Pressable
        onPress={handleOpenCard}
        accessibilityRole="button"
        accessibilityLabel={`${photo.caption || "Albüm"} albümünü aç`}
        style={styles.heroFrame}
      >
        {heroImageUri ? (
          isVideoMediaUri(heroImageUri) ? (
            <View style={{ width: "100%", height: "100%" }}>
              <VideoThumbnailPreview
                candidateUris={[
                  photo.imageVariants?.thumbnail,
                  photo.imageVariants?.medium,
                  photo.imageVariants?.full,
                ]}
                uri={heroImageUri}
                priority={highPriority ? "eager" : "deferred"}
                style={{ width: "100%", height: "100%" }}
              />
              <View style={styles.videoOverlay}>
                <Play
                  size={tokens.iconSize["3xl"]}
                  color={tokens.colors.onMedia}
                  strokeWidth={1.8}
                />
              </View>
            </View>
          ) : (
            <AppImage
              highPriority={highPriority}
              uri={heroImageUri}
              variants={photo.imageVariants}
              variant={imageVariant}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          )
        ) : null}
        {photoCount > 1 ? (
          <View style={styles.countBadgeContainer}>
            <Text style={styles.countBadge}>1/{photoCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <AlbumCardDetails context={context} photo={photo} presentation={presentation} />

      <AlbumCardFooter
        liked={state.liked}
        likes={state.likes}
        comments={state.commentCount}
        onLike={() => {
          void state.handleLike();
        }}
        onLikeLongPress={handleOpenLikes}
        onComment={handleOpenComments}
        onOpenEvent={state.handleActionPress}
        eventLabel={state.buttonAction.label}
        eventDisabled={state.buttonAction.action === "disabled"}
        hideEventAction={hideEventAction || context === "event_album"}
      />
    </AlbumCardSurface>
  );
});

const styles = StyleSheet.create({
  countBadge: {
    backgroundColor: withAlpha(tokens.colors.foreground, 0.62),
    borderRadius: tokens.radius.pill,
    color: tokens.colors.onMedia,
    fontSize: tokens.typography.caption,
    fontWeight: "700",
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xxs,
  },
  countBadgeContainer: {
    position: "absolute",
    right: 8,
    top: 8,
  },
  heroFrame: {
    backgroundColor: tokens.colors.border,
    height: 176,
    position: "relative",
    width: "100%",
  },
  videoOverlay: {
    alignItems: "center",
    backgroundColor: withAlpha(tokens.colors.foreground, 0.18),
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
