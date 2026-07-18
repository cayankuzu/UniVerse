import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import { getNotificationBadgeQueryDef } from "../../../data/notifications";
import { projectionKeys, readProjectionItems } from "../../../data/projections";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import { createStableQueryOptions } from "../../../data/query/options";
import type { AuthUserData } from "../../../data/contracts/entities";
import { persistWarmupHomeScope } from "../data";
import { getHomeFeedQueryDef } from "../data/homeRepository";
import { persistHomeStartupSnapshot, useHomeStartupSnapshot } from "../data/homeStartupSnapshot";
import { shouldUseHomeStartupPreview } from "./homeStartupPreviewPolicy";
import type { HomeFeedItem } from "../data";
import type { HomeViewerData } from "./homeScreen.types";
import { resolveHomeUnreadCount } from "./homeUnreadState";
import type { useHomeScreenUiState } from "./useHomeScreenUiState";
import { useHomeDeferredProfileSupplement } from "./useHomeDeferredProfileSupplement";
import { useHomePerceivedSpeedGate } from "./useHomePerceivedSpeedGate";

type UseHomeProjectionStateParams = {
  blockedUsers?: string[];
  uiState: ReturnType<typeof useHomeScreenUiState>;
  userData: AuthUserData;
  viewer: HomeViewerData;
  viewerKey: string;
};

export function useHomeProjectionState(params: UseHomeProjectionStateParams) {
  const queryClient = useQueryClient();
  const persistedHomeScopeRef = useRef("");
  const homeFeedDef = getHomeFeedQueryDef({
    blockedUsernames: params.blockedUsers,
    entityFilter: params.uiState.deferredEntityFilter,
    sortOption: params.uiState.deferredSortOption,
    sourceFilter: params.uiState.deferredSourceFilter,
    typeFilter: params.uiState.deferredTypeFilter,
    viewer: params.viewer,
  });
  const homeProjection = useProjectionScreen<HomeFeedItem>({
    ...homeFeedDef,
    autoRefreshOnFocus: false,
    enabled: Boolean(params.userData.id),
  });
  const filterScope = homeFeedDef.filterScope;
  const badgeDef = getNotificationBadgeQueryDef(params.viewer);
  const startupSnapshot = useHomeStartupSnapshot(params.viewerKey, filterScope);
  const startupPreviewItems = Array.isArray(startupSnapshot?.items) ? startupSnapshot.items : [];
  const hasHomeProjectionContent = homeProjection.items.length > 0;
  const hasHomeProjectionSnapshot = Number(homeProjection.screenState?.ids?.length || 0) > 0;
  const shouldUseStartupPreview = shouldUseHomeStartupPreview({
    hasProjectionContent: hasHomeProjectionContent,
    startupPreviewItemsLength: startupPreviewItems.length,
    startupSnapshotSavedAt: startupSnapshot?.savedAt,
  });
  const refreshing = homeProjection.refreshing;
  const hasImmediateContent = hasHomeProjectionContent || shouldUseStartupPreview;
  const speedGate = useHomePerceivedSpeedGate({
    hasImmediateContent,
    hasUserInteracted: params.uiState.hasUserInteracted,
    scopeKey: `${params.viewerKey}:${filterScope}`,
  });
  const badgeQuery = useQuery({
    ...createStableQueryOptions(badgeDef.staleTime),
    enabled: Boolean(params.userData.id) && speedGate.allowSecondaryReads,
    placeholderData: (previousData) => previousData,
    queryFn: badgeDef.queryFn,
    queryKey: badgeDef.queryKey,
  });
  const onRefresh = useScreenRefresh({
    enabled: true,
    screenKey: `home:${homeFeedDef.viewerKey}:${homeFeedDef.filterScope}`,
    surface: "home",
    tasks: [
      {
        bestEffort: true,
        id: "notification-badge",
        lane: "background",
        run: () => badgeQuery.refetch(),
      },
      {
        id: "home-projection",
        run: () => homeProjection.onRefresh(),
      },
    ],
  });
  const cachedNotificationsUnreadCount = readProjectionItems<NotificationItem>(
    queryClient,
    projectionKeys.notifications(params.viewerKey, "all"),
    "notifications",
  ).reduce((count, item) => (item.read ? count : count + 1), 0);
  const unread = resolveHomeUnreadCount({
    badgeUnreadCount: badgeQuery.data?.unreadCount,
    cachedNotificationsUnreadCount,
    shouldUseStartupPreview,
    startupUnreadCount: startupSnapshot?.unreadCount,
  });

  useHomeDeferredProfileSupplement({
    blockedUsers: params.blockedUsers,
    allowSecondaryReads: speedGate.allowSecondaryReads,
    entityFilter: params.uiState.deferredEntityFilter,
    filterScope,
    homeProjection,
    queryClient,
    queryEntity: homeFeedDef.entity,
    queryKey: homeFeedDef.queryKey,
    sortOption: params.uiState.deferredSortOption,
    sourceFilter: params.uiState.deferredSourceFilter,
    typeFilter: params.uiState.deferredTypeFilter,
    userData: params.userData,
    userHasInteracted: params.uiState.hasUserInteracted,
    viewer: params.viewer,
    viewerKey: params.viewerKey,
  });

  useEffect(() => {
    if (!params.uiState.restoreReady || !homeProjection.query.isSuccess) {
      return;
    }
    const persistKey = `${params.viewerKey}:${filterScope}:${homeProjection.screenState?.touchedAt || 0}`;
    if (persistedHomeScopeRef.current === persistKey) return;
    persistedHomeScopeRef.current = persistKey;
    void persistWarmupHomeScope(params.viewerKey, {
      entityFilter: params.uiState.deferredEntityFilter,
      scope: filterScope,
      sortOption: params.uiState.deferredSortOption,
      sourceFilter: params.uiState.deferredSourceFilter,
      typeFilter: params.uiState.deferredTypeFilter,
    });
  }, [
    filterScope,
    homeProjection.query.isSuccess,
    homeProjection.screenState?.touchedAt,
    params.uiState.deferredEntityFilter,
    params.uiState.deferredSortOption,
    params.uiState.deferredSourceFilter,
    params.uiState.deferredTypeFilter,
    params.uiState.restoreReady,
    params.viewerKey,
  ]);

  useEffect(() => {
    if (!homeProjection.query.isSuccess || !hasHomeProjectionContent) {
      return;
    }
    persistHomeStartupSnapshot({
      filterScope,
      items: homeProjection.items,
      savedAt: Date.now(),
      unreadCount: unread,
      viewerKey: params.viewerKey,
    });
  }, [
    filterScope,
    hasHomeProjectionContent,
    homeProjection.items,
    homeProjection.query.isSuccess,
    params.viewerKey,
    unread,
  ]);

  return {
    filterScope,
    hasHomeProjectionContent,
    hasHomeProjectionSnapshot,
    homeProjection,
    onRefresh,
    refreshing,
    shouldUseStartupPreview,
    speedGate,
    startupPreviewItems,
    unread,
  };
}
