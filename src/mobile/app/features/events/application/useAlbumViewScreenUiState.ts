import { useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { normalizeAlbumViewValue } from "../domain/albumUploadState";
import { getEventAlbumGridMetrics } from "../domain/eventAlbumGrid";

interface UseAlbumViewScreenUiStateParams {
  eventId: string;
  targetPhotoId?: string;
}

export function useAlbumViewScreenUiState(params: UseAlbumViewScreenUiStateParams) {
  const { eventId, targetPhotoId } = params;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const grid = useMemo(
    () => getEventAlbumGridMetrics(windowWidth, windowHeight),
    [windowHeight, windowWidth],
  );
  const normalizedEventId = useMemo(() => normalizeAlbumViewValue(eventId), [eventId]);
  const normalizedTargetPhotoId = useMemo(
    () => normalizeAlbumViewValue(targetPhotoId || ""),
    [targetPhotoId],
  );

  return {
    grid,
    normalizedEventId,
    normalizedTargetPhotoId,
    setViewerIndex,
    viewerIndex,
  };
}
