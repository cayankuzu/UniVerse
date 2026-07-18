import { useQuery } from "@tanstack/react-query";

import type {
  AlbumEventProjectionItem,
  EventDetailProjection,
} from "../../../data/projections/projections.types";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import {
  fetchAlbumUploadAvailability,
  fetchNotificationTargetAlbumPhoto,
  getAlbumEventProjectionQueryDef,
  getEventDetailProjectionQueryDef,
} from "../data";

function normalizeAlbumViewPhotoId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

interface UseAlbumViewProjectionQueriesParams {
  eventId: string;
  isTempEvent: boolean;
  normalizedTargetPhotoId: string;
  userData: {
    id?: string;
    username: string;
  };
  viewerKey: string;
}

export function useAlbumViewProjectionQueries({
  eventId,
  isTempEvent,
  normalizedTargetPhotoId,
  userData,
  viewerKey,
}: UseAlbumViewProjectionQueriesParams) {
  const viewer = { id: userData.id, username: userData.username };
  const detailProjection = useProjectionScreen<EventDetailProjection>({
    ...getEventDetailProjectionQueryDef({ eventId, viewer }),
    autoRefreshOnFocus: true,
    enabled: !!eventId && !isTempEvent,
  });
  const albumsProjection = useProjectionScreen<AlbumEventProjectionItem>({
    ...getAlbumEventProjectionQueryDef({ eventId, viewer }),
    autoRefreshOnFocus: true,
    enabled: !!eventId && !isTempEvent,
  });
  const hasTargetPhotoInProjection =
    Boolean(normalizedTargetPhotoId) &&
    (albumsProjection.items || []).some(
      (item) => normalizeAlbumViewPhotoId(item.id) === normalizedTargetPhotoId,
    );
  const uploadAvailabilityQuery = useQuery({
    enabled: false,
    placeholderData: (previous) => previous,
    queryFn: () => fetchAlbumUploadAvailability(eventId, String(userData.id || "")),
    queryKey: ["album-upload-availability", eventId, userData.id],
    staleTime: 15_000,
  });
  const notificationTargetPhotoQuery = useQuery({
    enabled: !!eventId && !!normalizedTargetPhotoId && !hasTargetPhotoInProjection && !isTempEvent,
    placeholderData: (previous) => previous,
    queryFn: () => fetchNotificationTargetAlbumPhoto(eventId, normalizedTargetPhotoId),
    queryKey: ["album-view-notification-target", eventId, normalizedTargetPhotoId, viewerKey],
    staleTime: 15_000,
  });
  const onRefresh = useScreenRefresh({
    enabled: !isTempEvent,
    maxParallel: 2,
    screenKey: `album-view:${viewerKey}:${eventId}`,
    surface: "event-detail",
    tasks: [
      { id: "event-detail", run: () => detailProjection.onRefresh() },
      { id: "album-event", run: () => albumsProjection.onRefresh() },
      {
        bestEffort: true,
        id: "upload-availability",
        lane: "background",
        run: () => uploadAvailabilityQuery.refetch(),
      },
    ],
  });

  return {
    albumsProjection,
    detailProjection,
    notificationTargetPhotoQuery,
    onRefresh,
    uploadAvailabilityQuery,
  };
}
