import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "../../../shared/i18n";
import type { EventDetailProjection } from "../../../data/projections/projections.types";
import { useViewerRelations } from "../../../data/social";
import type { AuthUserData } from "../../../data/contracts/entities";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { getEventDetailProjectionQueryDef, readOptimisticEventDetail } from "../data";

function normalizeClubUsername(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

interface UseEventDetailScreenStateParams {
  openAlbumView: (eventId: string) => void;
  openProfile: (username: string, options?: { previewImage?: string | null | undefined }) => void;
  userData: AuthUserData;
}

export function useEventDetailScreenState(
  eventId: string,
  params: UseEventDetailScreenStateParams,
) {
  const queryClient = useQueryClient();
  const isTempEvent = eventId.startsWith("temp-event:");
  const detailProjection = useProjectionScreen<EventDetailProjection>({
    ...getEventDetailProjectionQueryDef({
      eventId,
      viewer: { id: params.userData.id, username: params.userData.username },
    }),
    autoRefreshOnFocus: true,
    enabled: !!eventId && !isTempEvent,
  });
  const { optimisticDetail, optimisticEvent } = readOptimisticEventDetail(queryClient, eventId);
  const eventItem =
    detailProjection.items[0] ||
    optimisticDetail ||
    (optimisticEvent
      ? {
          albumCount: Number(optimisticEvent.albumCount || 0),
          event: optimisticEvent,
          id: optimisticEvent.id,
        }
      : null);
  const event = eventItem?.event ? { ...eventItem.event, albumCount: eventItem.albumCount } : null;
  const normalizedClubUsername = normalizeClubUsername(event?.clubUsername);
  const { buildRelationByClub, refetch: refetchViewerRelations } = useViewerRelations({
    enabled: Boolean(normalizedClubUsername),
    viewerId: params.userData.id,
    viewerUsername: params.userData.username,
  });
  const relations = normalizedClubUsername ? buildRelationByClub([normalizedClubUsername]) : {};
  const refreshDetailProjection = detailProjection.onRefresh;
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshDetailProjection(), refetchViewerRelations()]);
  }, [refreshDetailProjection, refetchViewerRelations]);

  return {
    detailProjection,
    errorMessage: detailProjection.query.error && !event ? t("events.detail.error.load") : null,
    event,
    isEmpty: !detailProjection.query.isLoading && !event,
    loading: !event && detailProjection.shouldShowInitialSkeleton,
    onRefresh,
    openAlbumView: params.openAlbumView,
    openProfile: params.openProfile,
    relation: relations[normalizedClubUsername],
  };
}
