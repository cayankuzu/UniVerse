import { useMemo } from "react";
import { Alert } from "react-native";
import { View } from "react-native";
import { useProgressiveHydration } from "../../../../shared/utils/useProgressiveHydration";
import { useAlbumDetailCardState } from "../../application/useAlbumDetailCardState";
import type { AlbumPhotoWithMeta, AuthUserData, RelationSnapshot } from "../../data";
import { AlbumMediaCarousel } from "../AlbumMediaCarousel";
import { AlbumDetailContent } from "./AlbumDetailContent";
import { AlbumDetailFooter } from "./AlbumDetailFooter";
import { AlbumDetailHeader } from "./AlbumDetailHeader";
import { AlbumDetailInteractions } from "./AlbumDetailInteractions";
import { type OverflowActionItem } from "../../../../shared/components";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { reportAlbum } from "../../data";
import { tokens } from "../../../../shared/theme";

type AlbumDetailCardContext = "feed" | "search" | "profile" | "event_album";

type Props = {
  context?: AlbumDetailCardContext;
  onOpenEvent: (eventId: string) => void;
  onOpenClub: (clubUsername: string) => void;
  onOpenProfile: (username: string) => void;
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
  viewer: AuthUserData;
};

export function AlbumDetailCard({
  context = "profile",
  onOpenEvent,
  onOpenClub,
  onOpenProfile,
  onShowWarning,
  photo,
  relations,
  viewer,
}: Props) {
  const state = useAlbumDetailCardState({
    context,
    currentUsername: viewer.username,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    userData: viewer,
  });
  const showSecondaryContent = useProgressiveHydration(photo.id);
  const photoCount = Math.max(Number(photo.photoCount || photo.images?.length || 1), 1);
  const currentUser = useMemo(
    () => ({
      id: state.userData.id,
      image: state.userData.profileImage,
      name: state.userData.name || state.userData.clubName || state.userData.username,
      university: state.userData.university,
      username: state.userData.username,
    }),
    [
      state.userData.clubName,
      state.userData.id,
      state.userData.name,
      state.userData.profileImage,
      state.userData.university,
      state.userData.username,
    ],
  );
  const previewActions = useMemo<OverflowActionItem[]>(() => {
    if (!photo.image) return [];
    const normalize = (value: string) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const isOwnPhoto =
      String(photo.userId || "") === String(viewer.id || "") ||
      normalize(viewer.username) === normalize(photo.username || "") ||
      String(photo.clubUserId || "") === String(viewer.id || "") ||
      normalize(viewer.username) === normalize(photo.clubUsername || "");

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
  const shouldRenderInteractions =
    state.showComments || state.showLikesModal || state.showImagePreview;

  return (
    <>
      <View
        style={{
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: "rgba(15,23,42,0.07)",
        }}
      >
        <AlbumDetailHeader
          photo={photo}
          onOpenProfile={onOpenProfile}
          showAvatar={context !== "profile"}
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

        <AlbumDetailContent
          context={context}
          photo={photo}
          showSecondaryContent={showSecondaryContent}
        />

        <AlbumDetailFooter
          liked={state.liked}
          likes={state.likes}
          commentCount={state.commentCount}
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
        />
      </View>

      {shouldRenderInteractions ? (
        <AlbumDetailInteractions
          canDeleteComment={state.canDeleteComment}
          comments={state.comments}
          commentsRefreshing={state.commentsRefreshing}
          currentUser={currentUser}
          likes={state.likes}
          likesLoading={state.likesLoading}
          likesRefreshing={state.likesRefreshing}
          likers={state.likers}
          loadCommentLikers={state.loadCommentLikers}
          loadLikers={state.loadLikers}
          onAddComment={state.handleAddComment}
          onCloseComments={() => state.setShowComments(false)}
          onCloseImagePreview={() => state.setShowImagePreview(false)}
          onCloseLikes={() => state.setShowLikesModal(false)}
          onDeleteComment={state.handleDeleteComment}
          onOpenProfile={onOpenProfile}
          onRefreshComments={state.refreshComments}
          onReportComment={state.handleReportComment}
          onToggleCommentLike={state.handleToggleCommentLike}
          ownerUsername={photo.username}
          previewActions={previewActions}
          previewImages={state.previewImages}
          previewIndex={state.previewIndex}
          setPreviewIndex={state.setPreviewIndex}
          showComments={state.showComments}
          showImagePreview={state.showImagePreview}
          showLikesModal={state.showLikesModal}
        />
      ) : null}
    </>
  );
}
