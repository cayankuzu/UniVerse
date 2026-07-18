import { memo, useMemo } from "react";
import { Alert } from "react-native";
import { AlbumMediaCarousel } from "../AlbumMediaCarousel";
import { AlbumCardFooter } from "./AlbumCardFooter";
import { AlbumCardModals } from "./AlbumCardModals";
import { DeferredAlbumFeedCard } from "./DeferredAlbumFeedCard";
import {
  AlbumCardDetails,
  AlbumCardHeaderSection,
  AlbumCardSurface,
  type AlbumFeedCardProps,
} from "./AlbumFeedCard.shared";
import { useAlbumFeedCardState } from "./useAlbumFeedCardState";
import { type OverflowActionItem } from "../../../../shared/components";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { reportAlbum } from "../../data";

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export const AlbumFeedCard = memo(function AlbumFeedCard({
  deferModalActions = false,
  ...props
}: AlbumFeedCardProps) {
  return deferModalActions ? (
    <DeferredAlbumFeedCard {...props} />
  ) : (
    <InteractiveAlbumFeedCard {...props} />
  );
});

const InteractiveAlbumFeedCard = memo(function InteractiveAlbumFeedCard({
  photo,
  currentUsername,
  presentation,
  viewer,
  relations,
  onOpenEvent,
  onOpenClub,
  onOpenProfile,
  onShowWarning,
  context = "feed",
  hideEventAction = false,
  isTourTarget = false,
  renderTourAnchor,
}: AlbumFeedCardProps) {
  const photoCount = Math.max(
    Number(presentation?.photoCount || photo.photoCount || photo.images?.length || 1),
    1,
  );
  const state = useAlbumFeedCardState({
    context,
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    viewer,
  });
  const previewActions = useMemo<OverflowActionItem[]>(() => {
    if (!photo.image) return [];
    const isOwnPhoto =
      String(photo.userId || "") === String(viewer.id || "") ||
      normalizeText(viewer.username) === normalizeText(photo.username || "") ||
      String(photo.clubUserId || "") === String(viewer.id || "") ||
      normalizeText(viewer.username) === normalizeText(photo.clubUsername || "");

    return [
      {
        key: isOwnPhoto ? "download" : "report",
        label: isOwnPhoto ? "Indir" : "Şikayet Et",
        destructive: !isOwnPhoto,
        onPress: () => {
          void (async () => {
            try {
              if (isOwnPhoto) {
                await downloadMediaToGallery({
                  fileName: photo.image,
                  kind: isVideoMediaUri(photo.image) ? "video" : "image",
                  uri: photo.image,
                });
                return;
              }
              await reportAlbum({ photoId: photo.id, username: photo.username });
            } catch (error) {
              Alert.alert(
                isOwnPhoto ? "Indirme başarısız" : "Şikayet gönderilemedi",
                String((error as { message?: string } | null)?.message || "İşlem tamamlanamadı."),
              );
            }
          })();
        },
      },
    ];
  }, [
    photo.clubUserId,
    photo.clubUsername,
    photo.id,
    photo.image,
    photo.username,
    photo.userId,
    viewer.id,
    viewer.username,
  ]);

  return (
    <AlbumCardSurface isTourTarget={isTourTarget} renderTourAnchor={renderTourAnchor}>
      <AlbumCardHeaderSection
        photo={photo}
        presentation={presentation}
        menuActions={state.menuActions}
        onOpenProfile={onOpenProfile}
      />

      <AlbumMediaCarousel
        firstImageUri={photo.image}
        firstImageVariants={photo.imageVariants}
        images={state.previewImages}
        photoCount={photoCount}
        previewIndex={state.previewIndex}
        setPreviewIndex={state.setPreviewIndex}
        onPressImage={(index) => {
          state.setPreviewIndex(index);
          state.setShowImagePreview(true);
        }}
      />

      <AlbumCardDetails context={context} photo={photo} presentation={presentation} />

      <AlbumCardFooter
        liked={state.liked}
        likes={state.likes}
        comments={state.commentCount}
        menuActions={state.menuActions}
        onLike={() => {
          void state.handleLike();
        }}
        onLikeLongPress={() => {
          void state.handleOpenLikes();
        }}
        onComment={() => {
          void state.handleOpenComments();
        }}
        onOpenEvent={state.handleActionPress}
        eventLabel={state.buttonAction.label}
        eventDisabled={state.buttonAction.action === "disabled"}
        hideEventAction={hideEventAction || context === "event_album"}
      />

      <AlbumCardModals
        comments={state.comments}
        commentsRefreshing={state.commentsRefreshing}
        currentUser={{
          id: viewer.id,
          username: viewer.username,
          name: viewer.name || viewer.clubName || viewer.username,
          image: viewer.profileImage,
          university: viewer.university,
        }}
        likers={state.likers}
        likesCount={state.likes}
        likesLoading={state.likesLoading}
        likesRefreshing={state.likesRefreshing}
        ownerUsername={photo.username}
        canDeleteComment={state.canDeleteComment}
        onAddComment={state.handleAddComment}
        onCommentLike={state.handleToggleCommentLike}
        onCloseComments={() => state.setShowComments(false)}
        onCloseImagePreview={() => state.setShowImagePreview(false)}
        onCloseLikes={() => state.setShowLikesModal(false)}
        onDeleteComment={state.handleDeleteComment}
        onOpenCommentLikes={state.loadCommentLikers}
        onOpenUser={onOpenProfile}
        onRefreshComments={state.refreshComments}
        onRefreshLikes={() => {
          void state.loadLikers({ pullToRefresh: true });
        }}
        onReportComment={state.handleReportComment}
        previewActions={previewActions}
        previewImages={state.previewImages}
        previewIndex={state.previewIndex}
        setPreviewIndex={state.setPreviewIndex}
        showComments={state.showComments}
        showImagePreview={state.showImagePreview}
        showLikesModal={state.showLikesModal}
      />
    </AlbumCardSurface>
  );
});
