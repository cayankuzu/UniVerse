import { useEffect, useRef } from "react";
import type { AuthUserData } from "../../../data/contracts/entities";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { useContentIntentPrefetch } from "../../../data/projections/prefetch/useContentIntentPrefetch";
import { useAlbumViewScreenData } from "./useAlbumViewScreenData";
import { useAlbumViewScreenUiState } from "./useAlbumViewScreenUiState";

interface UseAlbumViewScreenStateParams {
  accountType: "club" | "student" | null | undefined;
  openEventDetail: (eventId: string) => void;
  openProfile: (username: string, options?: { previewImage?: string | null | undefined }) => void;
  userData: AuthUserData;
}

export function useAlbumViewScreenState(
  eventId: string,
  params: UseAlbumViewScreenStateParams,
  targetPhotoId?: string,
) {
  const ui = useAlbumViewScreenUiState({
    eventId,
    targetPhotoId,
  });
  const data = useAlbumViewScreenData({
    accountType: params.accountType,
    eventId,
    normalizedTargetPhotoId: ui.normalizedTargetPhotoId,
    openEventDetail: params.openEventDetail,
    openProfile: params.openProfile,
    userData: params.userData,
    viewerKey: getViewerKey(params.userData),
  });
  const { prefetchEventById } = useContentIntentPrefetch({
    id: data.userData.id,
    username: data.userData.username,
  });
  const initialPhotoFocusKeyRef = useRef<string | null>(null);
  const { normalizedEventId, normalizedTargetPhotoId, setViewerIndex } = ui;

  useEffect(() => {
    initialPhotoFocusKeyRef.current = null;
  }, [normalizedEventId, normalizedTargetPhotoId]);

  useEffect(() => {
    if (!normalizedTargetPhotoId) return;
    const focusKey = `${normalizedEventId}:${normalizedTargetPhotoId}`;
    if (initialPhotoFocusKeyRef.current === focusKey) return;
    if (!data.focusedNotificationPhoto) return;
    initialPhotoFocusKeyRef.current = focusKey;
    setViewerIndex(Math.max(0, data.focusedNotificationPhotoIndex));
  }, [
    data.focusedNotificationPhoto,
    data.focusedNotificationPhotoIndex,
    normalizedEventId,
    normalizedTargetPhotoId,
    setViewerIndex,
  ]);

  return {
    ...data,
    prefetchEventById,
    ...ui,
  };
}
