import type {
  AlbumEventProjectionItem,
  EventDetailProjection,
} from "../../../data/projections/projections.types";
import type { PendingAlbumPhoto } from "../data";
import { useAlbumViewAccessState } from "./useAlbumViewAccessState";
import { useAlbumViewPhotoState } from "./useAlbumViewPhotoState";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import type { EventWithMeta } from "../../../data/contracts/content";

interface UseAlbumViewDerivedStateParams {
  albumsProjectionItems: AlbumEventProjectionItem[];
  buildRelationByClub: (usernames: string[]) => Record<string, RelationSnapshot>;
  event: EventDetailProjection["event"] | EventWithMeta | null;
  eventQueryError?: unknown;
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

export function useAlbumViewDerivedState({
  albumsProjectionItems,
  buildRelationByClub,
  event,
  eventQueryError,
  normalizedTargetPhotoId,
  notificationTargetPhoto,
  notificationTargetPhotoFetched,
  notificationTargetPhotoLoading,
  pendingPhotos,
  userData,
}: UseAlbumViewDerivedStateParams) {
  const photoState = useAlbumViewPhotoState({
    albumsProjectionItems,
    buildRelationByClub,
    normalizedTargetPhotoId,
    notificationTargetPhoto,
    notificationTargetPhotoFetched,
    notificationTargetPhotoLoading,
    pendingPhotos,
    userData,
  });
  const accessState = useAlbumViewAccessState({
    buildRelationByClub,
    event,
    eventQueryError,
    hasViewerOwnedPhotos: photoState.hasViewerOwnedPhotos,
    userData,
  });

  return {
    ...accessState,
    ...photoState,
  };
}
