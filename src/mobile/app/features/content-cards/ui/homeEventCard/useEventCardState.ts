import { useCallback } from "react";
import { useEventCardInteractionState } from "../../application/useEventCardInteractionState";
import { useEventPendingCardActions } from "../../application/useEventPendingCardActions";
import { useEventCardUiState } from "../useEventCardUiState";
import type { HomeEventCardProps } from "./eventCard.types";

type Params = Pick<
  HomeEventCardProps,
  | "accountType"
  | "allowInfoActions"
  | "event"
  | "interactive"
  | "onShowWarning"
  | "relations"
  | "viewer"
>;

export function useEventCardState({
  accountType,
  allowInfoActions = false,
  event,
  interactive = true,
  onShowWarning,
  relations,
  viewer,
}: Params) {
  const ui = useEventCardUiState({
    resetKey: event.id,
  });
  const interaction = useEventCardInteractionState({
    accountType,
    allowInfoActions,
    event,
    interactive,
    onShowWarning,
    relations,
    showAttendeesModal: ui.showAttendeesModal,
    showLikesModal: ui.showLikesModal,
    userData: viewer,
  });
  const pending = useEventPendingCardActions({
    eventId: event.id,
    uploadStatus: event.uploadStatus,
  });

  const handleOpenComments = useCallback(async () => {
    if (!interactive) return;
    ui.setShowComments(true);
    await interaction.refreshComments(false);
  }, [interactive, interaction, ui]);

  const handleOpenLikes = useCallback(async () => {
    if (!interactive) return;
    ui.setShowLikesModal(true);
    await interaction.loadLikers();
  }, [interactive, interaction, ui]);

  const handleOpenAttendees = useCallback(async () => {
    if (!interaction.bodyActionsEnabled) return;
    ui.setShowAttendeesModal(true);
    await interaction.loadAttendees();
  }, [interaction, ui]);

  return {
    ...interaction,
    ...pending,
    ...ui,
    handleOpenAttendees,
    handleOpenComments,
    handleOpenLikes,
    imagePreviewHeight: ui.imagePreviewHeight,
    modalBottomPadding: ui.modalBottomPadding,
  };
}
