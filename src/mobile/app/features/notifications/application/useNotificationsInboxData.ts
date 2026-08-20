import { useMemo } from "react";
import type { NotificationItem } from "../../../data/contracts/api";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { getNotificationsQueryDef } from "../../../data/notifications/notificationsProjectionRepository";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import { FILTERS, type FilterCategory } from "./notificationsPresentation";
import {
  buildBlockedUsernameSet,
  deriveNotificationsInboxCollections,
} from "./notificationsCollections";

type ViewerIdentity = {
  id?: string;
  username: string;
};

interface UseNotificationsInboxDataParams {
  activeFilter: FilterCategory;
  blockedUsers: Array<string | null | undefined>;
  viewer: ViewerIdentity;
}

export function useNotificationsInboxData(params: UseNotificationsInboxDataParams) {
  const { activeFilter, blockedUsers, viewer } = params;
  const viewerKey = getViewerKey(viewer);
  const notificationsQueryDef = useMemo(
    () =>
      getNotificationsQueryDef({
        filter: "all",
        viewer: { id: viewer.id, username: viewer.username },
      }),
    [viewer.id, viewer.username],
  );
  const notificationsKey = notificationsQueryDef.queryKey;
  const badgeKey = projectionKeys.notificationBadge(viewerKey);
  const blockedSet = useMemo(() => buildBlockedUsernameSet(blockedUsers), [blockedUsers]);
  const notificationsProjection = useProjectionScreen<NotificationItem>({
    ...notificationsQueryDef,
    autoRefreshOnFocus: true,
  });
  const projectionItems = useMemo(
    () => notificationsProjection.items || [],
    [notificationsProjection.items],
  );
  const collections = useMemo(
    () =>
      deriveNotificationsInboxCollections({
        activeFilter,
        blockedSet,
        items: projectionItems,
      }),
    [activeFilter, blockedSet, projectionItems],
  );
  const onRefresh = useScreenRefresh({
    maxParallel: 2,
    screenKey: `notifications:${viewerKey}:${activeFilter}`,
    surface: "notifications",
    tasks: [
      {
        id: "notifications-projection",
        run: () => notificationsProjection.onRefresh(),
      },
    ],
  });
  return {
    badgeKey,
    filterCounts: collections.filterCounts,
    hasMore: notificationsProjection.hasMore,
    listItems: collections.listItems,
    loadMore: notificationsProjection.loadMore,
    loadingMore: notificationsProjection.loadingMore,
    notifications: collections.notifications,
    notificationsKey,
    notificationsProjectionItemCount: projectionItems.length,
    notificationsQuery: notificationsProjection.query,
    notificationsShowInitialSkeleton: notificationsProjection.shouldShowInitialSkeleton,
    onRefresh,
    pendingFollowRequestSet: collections.pendingFollowRequestSet,
    refreshing: notificationsProjection.refreshing,
    unreadNotificationCount: collections.unreadNotificationCount,
    viewerKey,
    visibleFilters: FILTERS,
    visibleFollowRequests: collections.visibleFollowRequests,
  };
}
