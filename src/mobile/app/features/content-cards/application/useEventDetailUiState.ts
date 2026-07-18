import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { debugWarn } from "../../../platform/logging/logger";

interface UseEventDetailUiStateParams {
  resetKey: string;
}

export function useEventDetailUiState({ resetKey }: UseEventDetailUiStateParams) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const modalBottomPadding = Math.max(insets.bottom + 12, 12);
  const imagePreviewHeight = Math.max(260, Math.min(Math.floor(windowHeight * 0.74), 560));
  const [showComments, setShowComments] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [copiedField, setCopiedField] = useState<"location" | "address" | null>(null);

  useEffect(() => {
    setShowComments(false);
    setShowLikesModal(false);
    setShowAttendeesModal(false);
    setShowLocationModal(false);
    setShowImagePreview(false);
    setCopiedField(null);
  }, [resetKey]);

  const handleCopyText = async (value: string, field: "location" | "address") => {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1200);
    } catch (error) {
      debugWarn("CONTENT-CARDS", "event-detail-copy-failed", {
        field,
        message: String(
          (error as { message?: string } | null)?.message || "event-detail-copy-failed",
        ),
      });
    }
  };

  return {
    copiedField,
    handleCopyText,
    imagePreviewHeight,
    modalBottomPadding,
    setShowAttendeesModal,
    setShowComments,
    setShowImagePreview,
    setShowLikesModal,
    setShowLocationModal,
    showAttendeesModal,
    showComments,
    showImagePreview,
    showLikesModal,
    showLocationModal,
  };
}
