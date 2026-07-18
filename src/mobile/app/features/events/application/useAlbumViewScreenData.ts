import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { AuthUserData } from "../../../data/contracts/entities";
import { readOptimisticEventDetail } from "../data";
import { removePendingAlbumUpload, retryPendingAlbumUpload, type PendingAlbumPhoto } from "../data";
import { useViewerRelations } from "../../../data/social";
import { useAlbumUploadComposerState } from "./useAlbumUploadComposerState";
import { useAlbumUploadQueueState } from "./useAlbumUploadQueueState";
import { useAlbumViewDerivedState } from "./useAlbumViewDerivedState";
import { useAlbumViewProjectionQueries } from "./useAlbumViewProjectionQueries";

interface UseAlbumViewScreenDataParams {
  accountType: "club" | "student" | null | undefined;
  eventId: string;
  normalizedTargetPhotoId: string;
  openEventDetail: (eventId: string) => void;
  openProfile: (username: string, options?: { previewImage?: string | null | undefined }) => void;
  userData: AuthUserData;
  viewerKey: string;
}

export function useAlbumViewScreenData({
  accountType,
  eventId,
  normalizedTargetPhotoId,
  openEventDetail,
  openProfile,
  userData,
  viewerKey,
}: UseAlbumViewScreenDataParams) {
  const queryClient = useQueryClient();
  const normalizedAccountType: "club" | "student" = accountType === "club" ? "club" : "student";
  const isTempEvent = eventId.startsWith("temp-event:");
  const queries = useAlbumViewProjectionQueries({
    eventId,
    isTempEvent,
    normalizedTargetPhotoId,
    userData,
    viewerKey,
  });
  const fallbackEvent = queries.detailProjection.items[0]?.event || null;
  const { pendingPhotos, processAlbumUploads, queueAlbumUpload, syncPendingAlbumQueue, uploading } =
    useAlbumUploadQueueState({
      accountType: normalizedAccountType,
      event: fallbackEvent,
      eventId,
      queryClient,
      userData,
      viewerKey,
    });
  const { optimisticEvent } = readOptimisticEventDetail(queryClient, eventId);
  const event = queries.detailProjection.items[0]?.event || optimisticEvent || null;
  const { buildRelationByClub, refetch: refetchViewerRelations } = useViewerRelations({
    enabled: Boolean(event) || queries.albumsProjection.items.length > 0,
    viewerId: userData.id,
    viewerUsername: userData.username,
  });
  const derived = useAlbumViewDerivedState({
    albumsProjectionItems: queries.albumsProjection.items || [],
    buildRelationByClub,
    event,
    eventQueryError: queries.detailProjection.query.error,
    normalizedTargetPhotoId,
    notificationTargetPhoto: queries.notificationTargetPhotoQuery.data || null,
    notificationTargetPhotoFetched: queries.notificationTargetPhotoQuery.isFetched,
    notificationTargetPhotoLoading:
      queries.notificationTargetPhotoQuery.isLoading ||
      queries.notificationTargetPhotoQuery.isFetching,
    pendingPhotos,
    userData,
  });
  const uploadComposer = useAlbumUploadComposerState({
    canUpload: derived.canUpload,
    eventId,
    isTempEvent,
    ownAlbumCount: queries.uploadAvailabilityQuery.data?.ownAlbumCount,
    pendingPhotos,
    persistedPhotos: derived.persistedPhotos,
    queueAlbumUpload,
    uploadMessage: derived.uploadMessage,
    userId: userData.id,
  });

  const handleRemovePending = useCallback(
    (pending: PendingAlbumPhoto) => {
      void (async () => {
        await removePendingAlbumUpload(pending.id);
        await syncPendingAlbumQueue();
      })();
    },
    [syncPendingAlbumQueue],
  );
  const handleRetryPending = useCallback(
    (pending: PendingAlbumPhoto) => {
      void (async () => {
        await retryPendingAlbumUpload(pending.id);
        await syncPendingAlbumQueue();
        await processAlbumUploads();
      })();
    },
    [processAlbumUploads, syncPendingAlbumQueue],
  );

  const initialLoading = queries.albumsProjection.query.isLoading && derived.photos.length === 0;
  const errorMessage = derived.accessMessage
    ? null
    : queries.albumsProjection.query.error || (queries.detailProjection.query.error && !event)
      ? "Albüm yüklenemedi."
      : null;

  const refreshProjections = queries.onRefresh;
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshProjections(), refetchViewerRelations()]);
  }, [refreshProjections, refetchViewerRelations]);

  return {
    accessMessage: derived.accessMessage,
    accountType: normalizedAccountType,
    albumsProjection: queries.albumsProjection,
    availableSelectionSlots: uploadComposer.availableSelectionSlots,
    closeMediaLibraryPicker: uploadComposer.closeMediaLibraryPicker,
    closeMediaSourcePicker: uploadComposer.closeMediaSourcePicker,
    canUpload: derived.canUpload,
    cropPending: uploadComposer.cropPending,
    detailProjection: queries.detailProjection,
    errorMessage,
    event,
    focusedNotificationPhoto: derived.focusedNotificationPhoto,
    focusedNotificationPhotoIndex: derived.focusedNotificationPhotoIndex,
    handleOpenUpload: uploadComposer.handleOpenUpload,
    handleMediaLibrarySelection: uploadComposer.handleMediaLibrarySelection,
    handleMediaSourceAction: uploadComposer.handleMediaSourceAction,
    handleRemovePending,
    handleRetryPending,
    hasSelectedProfileVisibility: uploadComposer.hasSelectedProfileVisibility,
    initialLoading,
    isTempEvent,
    newPhotoCaption: uploadComposer.newPhotoCaption,
    newPhotoTitle: uploadComposer.newPhotoTitle,
    normalizedSelectedPhotoIndex: uploadComposer.normalizedSelectedPhotoIndex,
    onRefresh,
    openEventDetail,
    openProfile,
    pendingPhotos,
    persistedPhotos: derived.persistedPhotos,
    photos: derived.photos,
    pickPhotos: uploadComposer.pickPhotos,
    refreshing: !isTempEvent && queries.albumsProjection.refreshing,
    relationByClub: derived.relationByClub,
    remainingAlbumSlots: uploadComposer.remainingAlbumSlots,
    remainingTotalSlots: uploadComposer.remainingTotalSlots,
    reorderSelectedPhoto: uploadComposer.reorderSelectedPhoto,
    reservedAlbumCount: uploadComposer.reservedAlbumCount,
    resetUploadState: uploadComposer.resetUploadState,
    selectPhoto: uploadComposer.selectPhoto,
    selectedMediaItems: uploadComposer.selectedMediaItems,
    selectedPhotoUris: uploadComposer.selectedPhotoUris,
    setNewPhotoCaption: uploadComposer.setNewPhotoCaption,
    setNewPhotoTitle: uploadComposer.setNewPhotoTitle,
    setShowAddPhoto: uploadComposer.setShowAddPhoto,
    setWarningMessage: uploadComposer.setWarningMessage,
    showAddPhoto: uploadComposer.showAddPhoto,
    showOnClubProfile: uploadComposer.showOnClubProfile,
    showOnOwnProfile: uploadComposer.showOnOwnProfile,
    subtitle: derived.subtitle,
    submitUpload: uploadComposer.submitUpload,
    targetPhotoPending: derived.targetPhotoPending,
    targetPhotoResolved: derived.targetPhotoResolved,
    updateShowOnClubProfile: uploadComposer.updateShowOnClubProfile,
    updateShowOnOwnProfile: uploadComposer.updateShowOnOwnProfile,
    uploadCheckPending: uploadComposer.uploadCheckPending,
    uploading,
    userData,
    viewerPhotos: derived.viewerPhotos,
    warningMessage: uploadComposer.warningMessage,
    cropSelectedPhoto: uploadComposer.cropSelectedPhoto,
    removeSelectedPhoto: uploadComposer.removeSelectedPhoto,
    selectedMediaCounts: uploadComposer.selectedMediaCounts,
    mediaSourceVisible: uploadComposer.mediaSourceVisible,
    mediaLibraryVisible: uploadComposer.mediaLibraryVisible,
  };
}
