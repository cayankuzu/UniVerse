import { useState } from "react";

export function useAlbumFeedCardUiState() {
  const [showComments, setShowComments] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  return {
    previewIndex,
    setPreviewIndex,
    setShowComments,
    setShowImagePreview,
    setShowLikesModal,
    showComments,
    showImagePreview,
    showLikesModal,
  };
}
