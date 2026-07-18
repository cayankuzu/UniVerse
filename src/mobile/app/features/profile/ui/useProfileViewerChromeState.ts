import { useCallback, useState } from "react";
import { useAutoClearingMessage } from "../../../shared/hooks/useAutoClearingMessage";

export function useProfileViewerChromeState() {
  const [viewerType, setViewerType] = useState<"events" | "albums" | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerTargetId, setViewerTargetId] = useState<string | null>(null);
  const { message: warningMessage, setMessage: setWarningMessage } = useAutoClearingMessage();

  const closeViewer = useCallback(() => {
    setViewerTargetId(null);
    setViewerType(null);
  }, []);

  const closeImageViewer = useCallback(() => {
    setViewerImage(null);
  }, []);

  return {
    closeImageViewer,
    closeViewer,
    setViewerImage,
    setViewerIndex,
    setViewerTargetId,
    setViewerType,
    setWarningMessage,
    viewerImage,
    viewerIndex,
    viewerTargetId,
    viewerType,
    warningMessage,
  };
}
