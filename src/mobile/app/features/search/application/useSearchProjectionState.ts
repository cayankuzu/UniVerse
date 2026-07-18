import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "../../../shared/i18n";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import { SEARCH_DISCOVERY_KINDS } from "../../../data/projections/searchDiscovery";
import { getProjectionState } from "../../../data/projections/projections";
import { prefetchProjectionScreen } from "../../../data/projections/prefetch/prefetchProjection";
import { resolveNetworkBudget } from "../../../data/projections/networkAwareBudget";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import type { AuthUserData } from "../../../data/contracts/entities";
import { mapAppDataErrorMessage } from "../../../data/errors/appDataError";
import { debugWarn } from "../../../platform/logging/logger";
import { persistWarmupSearchScope, SEARCH_DISCOVERY_SCOPE } from "../data";
import {
  getSearchQueryDef,
  type AlbumPhotoWithMeta,
  type EventWithMeta,
  type SearchUserResult,
} from "../data";
import type { useSearchUiState } from "./useSearchUiState";

type SearchProjectionItem = EventWithMeta | AlbumPhotoWithMeta | SearchUserResult;

const SEARCH_DISCOVERY_PREFETCH_STABILITY_MS = 180;
const SEARCH_DISCOVERY_PREFETCH_PAGE_SIZE = PAGE_SIZES.search;

type UseSearchProjectionStateParams = {
  searchUi: ReturnType<typeof useSearchUiState>;
  userData: AuthUserData;
  viewerKey: string;
};

export function useSearchProjectionState(params: UseSearchProjectionStateParams) {
  const queryClient = useQueryClient();
  const emptyDiscoveryRepairRef = useRef("");
  const inflightDiscoveryPrefetchesRef = useRef(new Set<string>());
  const {
    effectiveSearchInput,
    effectiveSearchScope,
    persistedSearchScopeRef,
    restoreReady,
    type,
  } = params.searchUi;
  const searchQueryDef = getSearchQueryDef({
    categoryFilter: effectiveSearchInput.category || undefined,
    feeFilter: effectiveSearchInput.fee,
    kind: type,
    queryText: effectiveSearchInput.query,
    sortMode: effectiveSearchInput.sort,
    universityFilter: effectiveSearchInput.university || undefined,
    viewer: {
      id: params.userData.id,
      username: params.userData.username,
    },
  });
  const searchProjection = useProjectionScreen<SearchProjectionItem>({
    ...searchQueryDef,
    autoRefreshOnFocus: false,
    enabled: true,
  });

  useEffect(() => {
    if (!restoreReady || effectiveSearchScope !== SEARCH_DISCOVERY_SCOPE) {
      inflightDiscoveryPrefetchesRef.current.clear();
      return;
    }
    if (
      searchProjection.shouldShowInitialSkeleton ||
      searchProjection.query.fetchStatus === "fetching"
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const networkBudget = resolveNetworkBudget();
      if (!networkBudget.allowIdlePrefetch) {
        return;
      }

      SEARCH_DISCOVERY_KINDS.forEach((nextKind) => {
        if (nextKind === type) return;
        const nextSearchQueryDef = getSearchQueryDef({
          kind: nextKind,
          viewer: {
            id: params.userData.id,
            username: params.userData.username,
          },
        });
        const requestKey = JSON.stringify(nextSearchQueryDef.queryKey);
        if (inflightDiscoveryPrefetchesRef.current.has(requestKey)) {
          return;
        }
        if (getProjectionState(queryClient, nextSearchQueryDef.queryKey)) {
          return;
        }

        inflightDiscoveryPrefetchesRef.current.add(requestKey);
        void prefetchProjectionScreen({
          entity: nextSearchQueryDef.entity,
          fetchProjection: () =>
            nextSearchQueryDef.fetchProjection({
              cursor: null,
              deltaToken: null,
              limit: SEARCH_DISCOVERY_PREFETCH_PAGE_SIZE,
              mode: "replace",
              since: null,
            }),
          queryClient,
          queryKey: nextSearchQueryDef.queryKey,
          source: "warmup",
          staleTime: nextSearchQueryDef.staleTime,
        })
          .catch((error) => {
            debugWarn("SEARCH/PREFETCH", "search-discovery-prefetch-failed", {
              kind: nextKind,
              message: String(
                (error as { message?: string } | null)?.message ||
                  "search-discovery-prefetch-failed",
              ),
              viewerKey: params.viewerKey,
            });
          })
          .finally(() => {
            inflightDiscoveryPrefetchesRef.current.delete(requestKey);
          });
      });
    }, SEARCH_DISCOVERY_PREFETCH_STABILITY_MS);

    return () => clearTimeout(timer);
  }, [
    effectiveSearchScope,
    params.userData.id,
    params.userData.username,
    params.viewerKey,
    queryClient,
    restoreReady,
    searchProjection.query.fetchStatus,
    searchProjection.shouldShowInitialSkeleton,
    type,
  ]);

  useEffect(() => {
    if (effectiveSearchScope !== SEARCH_DISCOVERY_SCOPE) {
      emptyDiscoveryRepairRef.current = "";
      return;
    }
    if (!restoreReady) return;
    if (!searchProjection.hasCachedSnapshot) {
      emptyDiscoveryRepairRef.current = "";
      return;
    }
    if (
      searchProjection.shouldShowInitialSkeleton ||
      searchProjection.query.fetchStatus === "fetching"
    ) {
      return;
    }
    if (searchProjection.items.length > 0) {
      emptyDiscoveryRepairRef.current = "";
      return;
    }
    const repairKey = `${params.viewerKey}:${type}:${effectiveSearchScope}`;
    if (emptyDiscoveryRepairRef.current === repairKey) return;
    emptyDiscoveryRepairRef.current = repairKey;
    void searchProjection.onBackgroundRefresh();
  }, [
    effectiveSearchScope,
    params.viewerKey,
    restoreReady,
    searchProjection,
    searchProjection.hasCachedSnapshot,
    searchProjection.items.length,
    searchProjection.onBackgroundRefresh,
    searchProjection.query.fetchStatus,
    searchProjection.shouldShowInitialSkeleton,
    type,
  ]);

  useEffect(() => {
    if (!restoreReady || !searchProjection.query.isSuccess) {
      return;
    }
    const persistKey = `${params.viewerKey}:${type}:${effectiveSearchScope}:${searchProjection.screenState?.touchedAt || 0}`;
    if (persistedSearchScopeRef.current === persistKey) return;
    persistedSearchScopeRef.current = persistKey;
    void persistWarmupSearchScope(params.viewerKey, {
      categoryFilter: effectiveSearchInput.category || undefined,
      feeFilter: effectiveSearchInput.fee,
      kind: type,
      queryText: effectiveSearchInput.query || undefined,
      scope: effectiveSearchScope,
      sortMode: effectiveSearchInput.sort,
      universityFilter: effectiveSearchInput.university || undefined,
    });
  }, [
    effectiveSearchInput.category,
    effectiveSearchInput.fee,
    effectiveSearchInput.query,
    effectiveSearchInput.sort,
    effectiveSearchInput.university,
    effectiveSearchScope,
    persistedSearchScopeRef,
    params.viewerKey,
    restoreReady,
    searchProjection.query.isSuccess,
    searchProjection.screenState?.touchedAt,
    type,
  ]);

  const onRefresh = useScreenRefresh({
    enabled: true,
    screenKey: `search:${params.viewerKey}:${type}:${effectiveSearchScope}`,
    surface: "search",
    tasks: [
      {
        id: "search-projection",
        run: () => searchProjection.onRefresh(),
      },
    ],
  });

  return {
    currentError: !searchProjection.query.error
      ? null
      : mapAppDataErrorMessage(
          searchProjection.query.error,
          {
            network: t("search.error.load"),
            not_found: t("search.error.load"),
          },
          t("search.error.load"),
        ),
    currentLoading: searchProjection.shouldShowInitialSkeleton,
    loadingMore: searchProjection.loadingMore,
    onRefresh,
    refreshing: searchProjection.refreshing,
    searchProjection,
  };
}
