import { useEffect, useState } from "react";

interface UseAlbumDetailUiStateParams {
  resetKey: string;
}

export function useAlbumDetailUiState({ resetKey }: UseAlbumDetailUiStateParams) {
  const [showComments, setShowComments] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    setShowComments(false);
    setShowLikesModal(false);
    setShowImagePreview(false);
    setPreviewIndex(0);
  }, [resetKey]);

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
