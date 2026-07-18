import { useCallback } from "react";
import type { AlbumPhotoWithMeta, ContentViewer, RelationSnapshot } from "../../data";
import { useAlbumFeedCardInteractionState } from "../../application/useAlbumFeedCardInteractionState";
import { useAlbumFeedCardMenuActions } from "../../application/useAlbumFeedCardMenuActions";
import { useAlbumFeedCardUiState } from "../useAlbumFeedCardUiState";

type Params = {
  context?: "feed" | "search" | "profile" | "event_album";
  currentUsername: string;
  onOpenClub: (clubUsername: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
  viewer: ContentViewer;
};

export function useAlbumFeedCardState({
  context = "feed",
  currentUsername,
  onOpenClub,
  onOpenEvent,
  onShowWarning,
  photo,
  relations,
  viewer,
}: Params) {
  const ui = useAlbumFeedCardUiState();
  const interaction = useAlbumFeedCardInteractionState({
    onShowWarning,
    photo,
    showLikesModal: ui.showLikesModal,
    userData: viewer,
  });
  const menu = useAlbumFeedCardMenuActions({
    context,
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    viewerUserId: viewer.id,
  });

  const handleOpenComments = useCallback(async () => {
    ui.setShowComments(true);
    await interaction.refreshComments();
  }, [interaction, ui]);

  const handleOpenLikes = useCallback(async () => {
    ui.setShowLikesModal(true);
    await interaction.loadLikers();
  }, [interaction, ui]);

  return {
    ...interaction,
    ...menu,
    ...ui,
    handleOpenComments,
    handleOpenLikes,
  };
}
