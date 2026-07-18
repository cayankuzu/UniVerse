import React, { useEffect, useState } from "react";
import { logAlbumMediaDebug, warnAlbumMediaDebug } from "../../application/mediaDebug";
import type { MediaSelection } from "../../../../shared/media/mediaPicker";
import { useEventAlbumUploadModalLayout } from "../../application/useEventAlbumUploadModalLayout";
import { EventAlbumUploadFormSection } from "./EventAlbumUploadFormSection";
import { EventAlbumUploadModalFrame } from "./EventAlbumUploadModalFrame";
import { EventAlbumUploadPreviewSection } from "./EventAlbumUploadPreviewSection";

type Props = {
  accountType: "club" | "student";
  visible: boolean;
  remainingAlbumSlots: number;
  selectedMediaItems: MediaSelection[];
  selectedPhotoUris: string[];
  selectedPhotoIndex: number;
  newPhotoTitle: string;
  newPhotoCaption: string;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  cropPending: boolean;
  hasSelectedProfileVisibility: boolean;
  uploadPending: boolean;
  onClose: () => void;
  onPickPhotos: () => void;
  onSelectPhoto: (index: number) => void;
  onReorderSelectedPhoto: (draggedUri: string, toIndex: number) => void;
  onCropSelectedPhoto: (index: number, uri: string) => void;
  onRemoveSelectedPhoto: (index: number) => void;
  onChangeTitle: (value: string) => void;
  onChangeCaption: (value: string) => void;
  onChangeShowOnClubProfile: (value: boolean) => void;
  onChangeShowOnOwnProfile: (value: boolean) => void;
  onSubmit: () => void;
};

export function EventAlbumUploadModal({
  accountType,
  visible,
  remainingAlbumSlots,
  selectedMediaItems,
  selectedPhotoUris,
  selectedPhotoIndex,
  newPhotoTitle,
  newPhotoCaption,
  showOnClubProfile,
  showOnOwnProfile,
  cropPending,
  hasSelectedProfileVisibility,
  uploadPending,
  onClose,
  onPickPhotos,
  onSelectPhoto,
  onReorderSelectedPhoto,
  onCropSelectedPhoto,
  onRemoveSelectedPhoto,
  onChangeTitle,
  onChangeCaption,
  onChangeShowOnClubProfile,
  onChangeShowOnOwnProfile,
  onSubmit,
}: Props) {
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);
  const { modalBottomPadding, previewWidth, setPreviewWidth, sheetMaxHeight } =
    useEventAlbumUploadModalLayout({
      selectedPhotoIndex,
      selectedPhotoUris,
      visible,
      draggingPhotoUri: "",
    });

  useEffect(() => {
    if (!visible) {
      setSwapSourceIndex(null);
    }
  }, [visible]);

  useEffect(() => {
    if (swapSourceIndex === null) return;
    if (swapSourceIndex < selectedPhotoUris.length) return;
    setSwapSourceIndex(null);
  }, [selectedPhotoUris.length, swapSourceIndex]);

  const handleThumbPress = (index: number) => {
    if (uploadPending) return;
    if (index < 0 || index >= selectedPhotoUris.length) {
      warnAlbumMediaDebug("thumb-press-out-of-range", {
        index,
        selectedCount: selectedPhotoUris.length,
        swapSourceIndex,
      });
      return;
    }
    logAlbumMediaDebug("thumb-press", {
      index,
      selectedCount: selectedPhotoUris.length,
      swapSourceIndex,
      uri: selectedPhotoUris[index] || "",
    });
    if (swapSourceIndex === null) {
      onSelectPhoto(index);
      return;
    }
    if (swapSourceIndex === index) {
      setSwapSourceIndex(null);
      onSelectPhoto(index);
      return;
    }
    const sourceUri = selectedPhotoUris[swapSourceIndex];
    if (sourceUri) {
      logAlbumMediaDebug("thumb-swap-commit", {
        fromIndex: swapSourceIndex,
        sourceUri,
        toIndex: index,
        targetUri: selectedPhotoUris[index] || "",
      });
      onReorderSelectedPhoto(sourceUri, index);
      onSelectPhoto(index);
    }
    setSwapSourceIndex(null);
  };

  return (
    <EventAlbumUploadModalFrame
      modalBottomPadding={modalBottomPadding}
      onClose={onClose}
      remainingAlbumSlots={remainingAlbumSlots}
      sheetMaxHeight={sheetMaxHeight}
      visible={visible}
    >
      <EventAlbumUploadPreviewSection
        cropPending={cropPending}
        handleThumbPress={handleThumbPress}
        onCropSelectedPhoto={onCropSelectedPhoto}
        onPickPhotos={onPickPhotos}
        onPreviewWidthChange={(width) => {
          if (width !== previewWidth) setPreviewWidth(width);
        }}
        onRemoveSelectedPhoto={onRemoveSelectedPhoto}
        onSelectPhoto={onSelectPhoto}
        previewWidth={previewWidth}
        selectedMediaItems={selectedMediaItems}
        selectedPhotoIndex={selectedPhotoIndex}
        selectedPhotoUris={selectedPhotoUris}
        uploadPending={uploadPending}
        onLongPressPhoto={(index) => {
          logAlbumMediaDebug("thumb-long-press", {
            index,
            selectedCount: selectedPhotoUris.length,
            uri: selectedPhotoUris[index] || "",
          });
          setSwapSourceIndex(index);
          onSelectPhoto(index);
        }}
        swapSourceIndex={swapSourceIndex}
      />

      <EventAlbumUploadFormSection
        accountType={accountType}
        newPhotoCaption={newPhotoCaption}
        newPhotoTitle={newPhotoTitle}
        onChangeCaption={onChangeCaption}
        onChangeShowOnClubProfile={onChangeShowOnClubProfile}
        onChangeShowOnOwnProfile={onChangeShowOnOwnProfile}
        onChangeTitle={onChangeTitle}
        onSubmit={onSubmit}
        selectedPhotoCount={selectedPhotoUris.length}
        hasSelectedProfileVisibility={hasSelectedProfileVisibility}
        showOnClubProfile={showOnClubProfile}
        showOnOwnProfile={showOnOwnProfile}
        uploadPending={uploadPending}
      />
    </EventAlbumUploadModalFrame>
  );
}
