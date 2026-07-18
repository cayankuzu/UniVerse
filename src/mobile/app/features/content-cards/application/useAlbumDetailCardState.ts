import { useCallback } from "react";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import type { AlbumPhotoWithMeta } from "../data";
import { useAlbumDetailInteractionState } from "./useAlbumDetailInteractionState";
import { useAlbumDetailMenuActions } from "./useAlbumDetailMenuActions";
import { useAlbumDetailUiState } from "./useAlbumDetailUiState";

type AlbumDetailCardContext = "feed" | "search" | "profile" | "event_album";

interface UseAlbumDetailCardStateParams {
  context?: AlbumDetailCardContext;
  currentUsername: string;
  onOpenClub: (clubUsername: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
  userData: AuthUserData;
}

export function useAlbumDetailCardState({
  context = "profile",
  currentUsername,
  onOpenClub,
  onOpenEvent,
  onShowWarning,
  photo,
  relations,
  userData,
}: UseAlbumDetailCardStateParams) {
  const ui = useAlbumDetailUiState({
    resetKey: photo.id,
  });
  const interaction = useAlbumDetailInteractionState({
    onShowWarning,
    photo,
    showLikesModal: ui.showLikesModal,
    userData,
  });
  const menu = useAlbumDetailMenuActions({
    context,
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    viewerUserId: userData.id,
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
