import { useCallback, useMemo, useState } from "react";
import type { AlbumEventProjectionItem } from "../../../data/projections/projections.types";
import { MAX_EVENT_ALBUM_CARDS, MAX_EVENT_ALBUM_PHOTOS } from "../data/remote/albums.upload";
import { useAutoClearingMessage } from "../../../shared/hooks/useAutoClearingMessage";
import { computeAlbumUploadState } from "../domain/albumUploadState";
import type { PendingAlbumPhoto } from "../data";
import { useAlbumProfileVisibilityState } from "./useAlbumProfileVisibilityState";
import { useAlbumUploadDraftState } from "./useAlbumUploadDraftState";
import { useAlbumUploadWorkflowActions } from "./useAlbumUploadWorkflowActions";

interface UseAlbumUploadComposerStateParams {
  canUpload: boolean;
  eventId: string;
  isTempEvent: boolean;
  ownAlbumCount?: number;
  pendingPhotos: PendingAlbumPhoto[];
  persistedPhotos: AlbumEventProjectionItem[];
  queueAlbumUpload: (params: {
    caption?: string;
    images: string[];
    mediaKinds: Array<"image" | "video">;
    showOnClubProfile?: boolean;
    showOnOwnProfile?: boolean;
    title?: string;
  }) => Promise<string>;
  uploadMessage: string;
  userId?: string;
}

export function useAlbumUploadComposerState({
  canUpload,
  eventId,
  isTempEvent,
  ownAlbumCount,
  pendingPhotos,
  persistedPhotos,
  queueAlbumUpload,
  uploadMessage,
  userId,
}: UseAlbumUploadComposerStateParams) {
  const draft = useAlbumUploadDraftState();
  const { message: warningMessage, setMessage: setWarningMessage } = useAutoClearingMessage();
  const [uploadCheckPending, setUploadCheckPending] = useState(false);
  const {
    resetProfileVisibility,
    showOnClubProfile,
    showOnOwnProfile,
    updateShowOnClubProfile,
    updateShowOnOwnProfile,
  } = useAlbumProfileVisibilityState();

  const { availableSelectionSlots, remainingAlbumSlots, remainingTotalSlots, reservedAlbumCount } =
    useMemo(
      () =>
        computeAlbumUploadState({
          maxAlbumCards: MAX_EVENT_ALBUM_CARDS,
          maxPhotos: MAX_EVENT_ALBUM_PHOTOS,
          pendingPhotos,
          persistedPhotos,
          selectedPhotoUris: draft.selectedPhotoUris,
          serverOwnAlbumCount: ownAlbumCount,
          userId,
        }),
      [draft.selectedPhotoUris, ownAlbumCount, pendingPhotos, persistedPhotos, userId],
    );
  const selectedMediaCounts = useMemo(() => {
    const imageCount = draft.selectedMediaItems.filter((item) => item.kind === "image").length;
    const videoCount = draft.selectedMediaItems.filter((item) => item.kind === "video").length;
    return {
      imageCount,
      totalCount: draft.selectedMediaItems.length,
      videoCount,
    };
  }, [draft.selectedMediaItems]);
  const hasSelectedProfileVisibility = showOnClubProfile || showOnOwnProfile;

  const resetUploadState = useCallback(() => {
    draft.resetUploadDraft();
    resetProfileVisibility();
  }, [draft, resetProfileVisibility]);

  const {
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    cropPending,
    cropSelectedPhoto,
    handleMediaLibrarySelection,
    handleMediaSourceAction,
    handleOpenUpload,
    mediaLibraryVisible,
    mediaSourceVisible,
    pickPhotos,
    submitUpload,
  } = useAlbumUploadWorkflowActions({
    availableSelectionSlots,
    canUpload,
    draft,
    eventId,
    hasSelectedProfileVisibility,
    isTempEvent,
    queueAlbumUpload,
    selectedMediaCounts,
    remainingAlbumSlots,
    remainingTotalSlots,
    resetUploadState,
    setUploadCheckPending,
    setWarningMessage,
    showOnClubProfile,
    showOnOwnProfile,
    uploadMessage,
    userId,
  });

  return {
    availableSelectionSlots,
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    cropPending,
    cropSelectedPhoto,
    handleMediaLibrarySelection,
    handleMediaSourceAction,
    handleOpenUpload,
    newPhotoCaption: draft.newPhotoCaption,
    newPhotoTitle: draft.newPhotoTitle,
    normalizedSelectedPhotoIndex: draft.normalizedSelectedPhotoIndex,
    mediaLibraryVisible,
    mediaSourceVisible,
    pickPhotos,
    remainingAlbumSlots,
    remainingTotalSlots,
    reorderSelectedPhoto: (draggedUri: string, toIndex: number) => {
      const sourceIndex = draft.selectedPhotoUris.indexOf(draggedUri);
      if (sourceIndex < 0) return;
      draft.swapSelectedMedia(sourceIndex, toIndex);
    },
    reservedAlbumCount,
    resetUploadState,
    removeSelectedPhoto: draft.removeSelectedMedia,
    selectPhoto: draft.selectMedia,
    selectedPhotoUris: draft.selectedPhotoUris,
    selectedMediaCounts,
    selectedMediaItems: draft.selectedMediaItems,
    setNewPhotoCaption: draft.setNewPhotoCaption,
    setNewPhotoTitle: draft.setNewPhotoTitle,
    setShowAddPhoto: draft.setShowAddPhoto,
    setWarningMessage,
    showAddPhoto: draft.showAddPhoto,
    hasSelectedProfileVisibility,
    showOnClubProfile,
    showOnOwnProfile,
    submitUpload,
    updateShowOnClubProfile,
    updateShowOnOwnProfile,
    uploadCheckPending,
    warningMessage,
  };
}
