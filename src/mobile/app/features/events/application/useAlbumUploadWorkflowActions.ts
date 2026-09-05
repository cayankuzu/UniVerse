import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { Platform } from "react-native";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import { t } from "../../../shared/i18n";
import { computeAlbumUploadState } from "../domain/albumUploadState";
import { pickAlbumMediaFromCamera, showAlbumUploadAlert } from "./albumMediaPicker";
import { cropEventAlbumPhoto } from "./eventAlbumNativeCrop";
import type { AlbumUploadDraftState } from "./useAlbumUploadDraftState";
import {
  isVideoMediaUri,
  type MediaSelection,
  waitForMediaPickerTransition,
} from "../../../shared/media/mediaPicker";

interface UseAlbumUploadWorkflowActionsParams {
  availableSelectionSlots: ReturnType<typeof computeAlbumUploadState>["availableSelectionSlots"];
  canUpload: boolean;
  draft: AlbumUploadDraftState;
  eventId: string;
  hasSelectedProfileVisibility: boolean;
  isTempEvent: boolean;
  queueAlbumUpload: (params: {
    caption?: string;
    mediaKinds: Array<"image" | "video">;
    images: string[];
    showOnClubProfile?: boolean;
    showOnOwnProfile?: boolean;
    title?: string;
  }) => Promise<string>;
  selectedMediaCounts: {
    imageCount: number;
    totalCount: number;
    videoCount: number;
  };
  remainingAlbumSlots: ReturnType<typeof computeAlbumUploadState>["remainingAlbumSlots"];
  remainingTotalSlots: ReturnType<typeof computeAlbumUploadState>["remainingTotalSlots"];
  resetUploadState: () => void;
  setUploadCheckPending: Dispatch<SetStateAction<boolean>>;
  setWarningMessage: (message: string) => void;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  uploadMessage: string;
  userId?: string;
}

export function useAlbumUploadWorkflowActions({
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
}: UseAlbumUploadWorkflowActionsParams) {
  const [mediaSourceVisible, setMediaSourceVisible] = useState(false);
  const [mediaLibraryVisible, setMediaLibraryVisible] = useState(false);
  const [cropPending, setCropPending] = useState(false);
  const [resumeComposerAfterPicker, setResumeComposerAfterPicker] = useState(false);

  const restoreComposerAfterPicker = useCallback(async () => {
    if (Platform.OS !== "ios" || !resumeComposerAfterPicker) return;
    await waitForMediaPickerTransition();
    draft.setShowAddPhoto(true);
    setResumeComposerAfterPicker(false);
  }, [draft, resumeComposerAfterPicker]);

  const handleOpenUpload = useCallback(async () => {
    if (isTempEvent) {
      showAlbumUploadAlert(t("events.album.warning.pendingEvent"), setWarningMessage);
      return;
    }
    if (!eventId) {
      showAlbumUploadAlert(t("events.album.warning.missingContext"), setWarningMessage);
      return;
    }
    if (remainingAlbumSlots <= 0) {
      showAlbumUploadAlert(
        "Her kullanıcı bu etkinliğe en fazla 3 albüm kartı ekleyebilir.",
        setWarningMessage,
      );
      return;
    }
    if (!canUpload) {
      showAlbumUploadAlert(
        uploadMessage || t("events.album.warning.permission"),
        setWarningMessage,
      );
      return;
    }

    setUploadCheckPending(false);
    draft.setShowAddPhoto(true);
  }, [
    canUpload,
    draft,
    eventId,
    isTempEvent,
    remainingAlbumSlots,
    setUploadCheckPending,
    setWarningMessage,
    uploadMessage,
  ]);

  const pickPhotos = useCallback(async () => {
    if (!canUpload) {
      showAlbumUploadAlert(
        uploadMessage || t("events.album.warning.permission"),
        setWarningMessage,
      );
      return;
    }
    if (remainingTotalSlots <= 0) {
      showAlbumUploadAlert(t("events.album.warning.maxTotal"), setWarningMessage);
      return;
    }
    if (availableSelectionSlots <= 0) {
      showAlbumUploadAlert(
        t("events.album.warning.remaining", { count: remainingTotalSlots }),
        setWarningMessage,
      );
      return;
    }
    if (Platform.OS === "ios") {
      setResumeComposerAfterPicker(true);
      draft.setShowAddPhoto(false);
      await waitForMediaPickerTransition();
    }
    setMediaSourceVisible(true);
  }, [
    availableSelectionSlots,
    canUpload,
    draft,
    remainingTotalSlots,
    setWarningMessage,
    uploadMessage,
  ]);

  const closeMediaSourcePicker = useCallback(() => {
    setMediaSourceVisible(false);
    void restoreComposerAfterPicker();
  }, [restoreComposerAfterPicker]);

  const closeMediaLibraryPicker = useCallback(() => {
    setMediaLibraryVisible(false);
    void restoreComposerAfterPicker();
  }, [restoreComposerAfterPicker]);

  const handleMediaSourceAction = useCallback(
    async (action: "camera-photo" | "camera-video" | "library") => {
      let openedLibrary = false;
      setMediaSourceVisible(false);
      await waitForMediaPickerTransition();

      try {
        debugLog("MEDIA/ALBUM", "source-action", {
          action,
          remainingTotalSlots,
          selectedCount: selectedMediaCounts.totalCount,
        });
        if (remainingTotalSlots <= 0) {
          showAlbumUploadAlert(t("events.album.warning.maxTotal"), setWarningMessage);
          return;
        }

        if (action === "library") {
          openedLibrary = true;
          setMediaLibraryVisible(true);
          return;
        }

        const nextMedia = await pickAlbumMediaFromCamera(
          action === "camera-video" ? "video" : "photo",
        );
        if (!nextMedia) return;
        draft.appendSelectedMediaItems([nextMedia], remainingTotalSlots);
        draft.setSelectedMediaIndex(selectedMediaCounts.totalCount);
        debugLog("MEDIA/ALBUM", "camera-selection-appended", {
          addedKind: nextMedia.kind,
          nextSelectedCount: selectedMediaCounts.totalCount + 1,
        });
      } catch (error) {
        debugWarn("MEDIA/ALBUM", "source-action-failed", { action, error });
        showAlbumUploadAlert(
          String(
            (error as { message?: string } | null)?.message ||
              "Medya eklenemedi. Lütfen tekrar dene.",
          ),
          setWarningMessage,
        );
      } finally {
        if (!openedLibrary) {
          void restoreComposerAfterPicker();
        }
      }
    },
    [
      draft,
      remainingTotalSlots,
      restoreComposerAfterPicker,
      selectedMediaCounts.totalCount,
      setWarningMessage,
    ],
  );

  const handleMediaLibrarySelection = useCallback(
    (items: MediaSelection[]) => {
      const accepted = items.slice(0, remainingTotalSlots);
      if (!accepted.length) {
        showAlbumUploadAlert(t("events.album.warning.maxTotal"), setWarningMessage);
        setMediaLibraryVisible(false);
        void restoreComposerAfterPicker();
        return;
      }
      draft.appendSelectedMediaItems(accepted, remainingTotalSlots);
      draft.setSelectedMediaIndex(selectedMediaCounts.totalCount);
      debugLog("MEDIA/ALBUM", "library-selection-appended", {
        acceptedCount: accepted.length,
        requestedCount: items.length,
        remainingTotalSlots,
        selectedCountBefore: selectedMediaCounts.totalCount,
        nextSelectedCount: selectedMediaCounts.totalCount + accepted.length,
      });
      setMediaLibraryVisible(false);
      void restoreComposerAfterPicker();
    },
    [
      draft,
      remainingTotalSlots,
      restoreComposerAfterPicker,
      selectedMediaCounts.totalCount,
      setWarningMessage,
    ],
  );

  const cropSelectedPhoto = useCallback(
    async (index: number, uri: string) => {
      if (!uri || cropPending) return;
      if (isVideoMediaUri(uri)) {
        showAlbumUploadAlert("Video kırpılamaz.", setWarningMessage);
        return;
      }
      setCropPending(true);
      debugLog("MEDIA/ALBUM", "crop-start", { index, uri });
      try {
        const croppedUri = await cropEventAlbumPhoto(uri);
        if (!croppedUri) return;
        draft.replaceSelectedMedia(index, {
          durationMs: null,
          fileName: null,
          kind: "image",
          mimeType: "image/jpeg",
          uri: croppedUri,
        });
        debugLog("MEDIA/ALBUM", "crop-success", { croppedUri, index });
      } catch (error) {
        debugWarn("MEDIA/ALBUM", "crop-failed", { error, index });
        setWarningMessage(t("events.album.warning.cropFailed"));
      } finally {
        setCropPending(false);
      }
    },
    [cropPending, draft, setWarningMessage],
  );

  const submitUpload = useCallback(async () => {
    const maxSelectableItems = selectedMediaCounts.totalCount + remainingTotalSlots;

    if (!draft.selectedPhotoUris.length || !eventId) {
      showAlbumUploadAlert(t("events.album.warning.noPhoto"), setWarningMessage);
      return;
    }
    if (!userId) {
      showAlbumUploadAlert(t("events.album.warning.missingContext"), setWarningMessage);
      return;
    }
    if (!hasSelectedProfileVisibility) {
      showAlbumUploadAlert("En az bir profil görünürlüğü seçmelisin.", setWarningMessage);
      return;
    }
    if (remainingAlbumSlots <= 0) {
      showAlbumUploadAlert(
        "Her kullanıcı bu etkinliğe en fazla 3 albüm kartı ekleyebilir.",
        setWarningMessage,
      );
      return;
    }
    if (draft.selectedPhotoUris.length > maxSelectableItems) {
      showAlbumUploadAlert(
        remainingTotalSlots <= 0
          ? t("events.album.warning.maxTotal")
          : t("events.album.warning.remaining", { count: remainingTotalSlots }),
        setWarningMessage,
      );
      return;
    }
    if (!canUpload) {
      await handleOpenUpload();
      return;
    }

    try {
      await queueAlbumUpload({
        caption: draft.newPhotoCaption.trim() || undefined,
        images: [...draft.selectedPhotoUris],
        mediaKinds: draft.selectedMediaItems.map((item) => item.kind),
        showOnClubProfile,
        showOnOwnProfile,
        title: draft.newPhotoTitle.trim() || undefined,
      });
      draft.setShowAddPhoto(false);
      resetUploadState();
    } catch (error) {
      debugWarn("MEDIA/ALBUM", "submit-upload-failed", { error, eventId });
      showAlbumUploadAlert(
        String(
          (error as { message?: string } | null)?.message ||
            "Medya yüklenemedi. Lütfen tekrar dene.",
        ),
        setWarningMessage,
      );
    }
  }, [
    canUpload,
    draft,
    eventId,
    handleOpenUpload,
    hasSelectedProfileVisibility,
    queueAlbumUpload,
    remainingAlbumSlots,
    remainingTotalSlots,
    resetUploadState,
    selectedMediaCounts.totalCount,
    setWarningMessage,
    showOnClubProfile,
    showOnOwnProfile,
    userId,
  ]);

  return {
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
  };
}
