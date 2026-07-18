import { useMemo } from "react";

import { filterEventAlbumSurfaceForViewer } from "../../../data/normalizers/albums";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import type { AlbumEventProjectionItem } from "../../../data/projections/projections.types";
import type { PendingAlbumPhoto } from "../data";
import { normalizeAlbumViewValue } from "../domain/albumUploadState";

interface UseAlbumViewPhotoStateParams {
  albumsProjectionItems: AlbumEventProjectionItem[];
  buildRelationByClub: (usernames: string[]) => Record<string, RelationSnapshot>;
  normalizedTargetPhotoId: string;
  notificationTargetPhoto: AlbumEventProjectionItem | null;
  notificationTargetPhotoFetched: boolean;
  notificationTargetPhotoLoading: boolean;
  pendingPhotos: PendingAlbumPhoto[];
  userData: {
    id?: string;
    username: string;
  };
}

export function useAlbumViewPhotoState({
  albumsProjectionItems,
  buildRelationByClub,
  normalizedTargetPhotoId,
  notificationTargetPhoto,
  notificationTargetPhotoFetched,
  notificationTargetPhotoLoading,
  pendingPhotos,
  userData,
}: UseAlbumViewPhotoStateParams) {
  const persistedPhotos = useMemo(
    () =>
      filterEventAlbumSurfaceForViewer(albumsProjectionItems || [], {
        viewerId: userData.id,
        viewerUsername: userData.username,
      }),
    [albumsProjectionItems, userData.id, userData.username],
  );
  const photos = useMemo<Array<AlbumEventProjectionItem | PendingAlbumPhoto>>(
    () => [
      ...filterEventAlbumSurfaceForViewer(pendingPhotos as AlbumEventProjectionItem[], {
        viewerId: userData.id,
        viewerUsername: userData.username,
      }),
      ...persistedPhotos,
    ],
    [pendingPhotos, persistedPhotos, userData.id, userData.username],
  );
  const relationByClub = useMemo(
    () =>
      buildRelationByClub(
        Array.from(
          new Set(
            photos.map((item) => normalizeAlbumViewValue(item.clubUsername || "")).filter(Boolean),
          ),
        ),
      ),
    [buildRelationByClub, photos],
  );
  const focusedNotificationPhoto = useMemo(() => {
    if (!normalizedTargetPhotoId) return null;
    return (
      persistedPhotos.find(
        (item) => normalizeAlbumViewValue(item.id) === normalizedTargetPhotoId,
      ) ||
      notificationTargetPhoto ||
      null
    );
  }, [normalizedTargetPhotoId, notificationTargetPhoto, persistedPhotos]);
  const focusedNotificationPhotoIndex = useMemo(() => {
    if (!focusedNotificationPhoto) return -1;
    const targetId = normalizeAlbumViewValue(focusedNotificationPhoto.id);
    return persistedPhotos.findIndex((item) => normalizeAlbumViewValue(item.id) === targetId);
  }, [focusedNotificationPhoto, persistedPhotos]);
  const viewerPhotos = useMemo(() => {
    if (!focusedNotificationPhoto) return persistedPhotos;
    if (focusedNotificationPhotoIndex >= 0) return persistedPhotos;
    return [focusedNotificationPhoto, ...persistedPhotos];
  }, [focusedNotificationPhoto, focusedNotificationPhotoIndex, persistedPhotos]);
  const targetPhotoPending =
    Boolean(normalizedTargetPhotoId) && !focusedNotificationPhoto && notificationTargetPhotoLoading;
  const targetPhotoResolved =
    !targetPhotoPending &&
    (!normalizedTargetPhotoId ||
      notificationTargetPhotoFetched ||
      Boolean(focusedNotificationPhoto));
  const hasViewerOwnedPhotos = photos.some(
    (item) =>
      normalizeAlbumViewValue(item.userId || item.clubUserId || "") ===
        normalizeAlbumViewValue(userData.id || "") ||
      normalizeAlbumViewValue(item.username || item.clubUsername || "") ===
        normalizeAlbumViewValue(userData.username),
  );

  return {
    focusedNotificationPhoto,
    focusedNotificationPhotoIndex,
    hasViewerOwnedPhotos,
    persistedPhotos,
    photos,
    relationByClub,
    targetPhotoPending,
    targetPhotoResolved,
    viewerPhotos,
  };
}
