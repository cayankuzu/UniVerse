/** ViewModel: useNotificationsInbox
 * UI composition hook - combines UI state, domain state, and feature-local data boundaries.
 * Never fetches data directly. All data access goes through the feature data layer. */
import { useEffect, useMemo } from "react";
import { debugLog } from "../../../platform/logging/logger";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import type { NotificationItem, UserDataLike } from "../data/notificationsNavigation.types";
import { useNotificationFollowRequestActions } from "./useNotificationFollowRequestActions";
import { useNotificationsInboxData } from "./useNotificationsInboxData";
import { useNotificationsInboxUiState } from "./useNotificationsInboxUiState";
import { useNotificationReadMutations } from "./useNotificationReadMutations";

export function useNotificationsInbox(params: {
  blockedUsers?: string[];
  navigateForNotification: (item: NotificationItem) => void;
  openProfile: (username: string) => void;
  userData: UserDataLike;
}) {
  const viewer = useMemo(
    () => ({
      id: params.userData.id,
      username: params.userData.username || "",
    }),
    [params.userData.id, params.userData.username],
  );
  const { activeFilter, notice, pushNotice, setActiveFilter } = useNotificationsInboxUiState();
  const notificationsData = useNotificationsInboxData({
    activeFilter,
    blockedUsers: params.blockedUsers || [],
    viewer,
  });
  const { handleNotifPress, markReadMutation } = useNotificationReadMutations({
    badgeKey: notificationsData.badgeKey,
    navigateForNotification: params.navigateForNotification,
    notifications: notificationsData.notifications,
    notificationsKey: notificationsData.notificationsKey,
    optimisticOutbox: useOptimisticOutboxMetaStore.getState(),
    unreadNotificationCount: notificationsData.unreadNotificationCount,
    viewerKey: notificationsData.viewerKey,
  });
  const followRequestActions = useNotificationFollowRequestActions({
    badgeKey: notificationsData.badgeKey,
    notifications: notificationsData.notifications,
    notificationsKey: notificationsData.notificationsKey,
    pushNotice,
    unreadNotificationCount: notificationsData.unreadNotificationCount,
    userData: viewer,
    viewerKey: notificationsData.viewerKey,
  });

  useEffect(() => {
    if (!__DEV__) return;
    debugLog("NOTIFICATIONS/SCREEN", "counts", {
      activeFilter,
      listItems: notificationsData.listItems.length,
      notificationsFromQuery: notificationsData.notificationsProjectionItemCount,
      notificationsVisible: notificationsData.notifications.length,
      unreadNotificationCount: notificationsData.unreadNotificationCount,
      visibleFollowRequests: notificationsData.visibleFollowRequests.length,
    });
    return undefined;
  }, [
    activeFilter,
    notificationsData.listItems.length,
    notificationsData.notifications.length,
    notificationsData.notificationsProjectionItemCount,
    notificationsData.unreadNotificationCount,
    notificationsData.visibleFollowRequests.length,
  ]);

  return {
    activeFilter,
    filterCounts: notificationsData.filterCounts,
    handleFollowRequestAction: followRequestActions.handleFollowRequestAction,
    handleInlineFollowRequestAction: followRequestActions.handleInlineFollowRequestAction,
    handleNotifPress,
    hasMore: notificationsData.hasMore,
    listItems: notificationsData.listItems,
    loadMore: notificationsData.loadMore,
    loadingMore: notificationsData.loadingMore,
    markReadMutation,
    notice,
    notificationsQuery: notificationsData.notificationsQuery,
    notificationsShowInitialSkeleton: notificationsData.notificationsShowInitialSkeleton,
    onRefresh: notificationsData.onRefresh,
    openProfile: params.openProfile,
    pendingFollowRequestSet: notificationsData.pendingFollowRequestSet,
    pendingFollowRequests: followRequestActions.pendingFollowRequests,
    pendingInlineFollowRequests: followRequestActions.pendingInlineFollowRequests,
    processedFollowRequests: followRequestActions.processedFollowRequests,
    processedInlineFollowRequests: followRequestActions.processedInlineFollowRequests,
    refreshing: notificationsData.refreshing,
    setActiveFilter,
    unreadCount: notificationsData.unreadNotificationCount,
    visibleFilters: notificationsData.visibleFilters,
    visibleFollowRequests: notificationsData.visibleFollowRequests,
  };
}
