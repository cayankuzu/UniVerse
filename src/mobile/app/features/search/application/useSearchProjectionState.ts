import { useEffect, useMemo } from "react";
import { t } from "../../../shared/i18n";
import { SEARCH_DISCOVERY_KINDS } from "../../../data/projections/searchDiscovery";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import type { AuthUserData } from "../../../data/contracts/entities";
import { mapAppDataErrorMessage } from "../../../data/errors/appDataError";
import { persistWarmupSearchScope } from "../data";
import { getSearchQueryDef } from "../data";
import { useSearchProjectionScreens } from "./useSearchProjectionScreens";
import type { useSearchUiState } from "./useSearchUiState";

type UseSearchProjectionStateParams = {
  searchUi: ReturnType<typeof useSearchUiState>;
  userData: AuthUserData;
  viewerKey: string;
};

export function useSearchProjectionState(params: UseSearchProjectionStateParams) {
  const {
    effectiveSearchInput,
    effectiveSearchScope,
    persistedSearchScopeRef,
    restoreReady,
    type,
  } = params.searchUi;
  const searchQueryDefs = useMemo(() => {
    const createQueryDef = (kind: (typeof SEARCH_DISCOVERY_KINDS)[number]) =>
      getSearchQueryDef({
        categoryFilter: effectiveSearchInput.category || undefined,
        feeFilter: effectiveSearchInput.fee,
        kind,
        queryText: effectiveSearchInput.query,
        sortMode: effectiveSearchInput.sort,
        universityFilter: effectiveSearchInput.university || undefined,
        viewer: {
          id: params.userData.id,
          username: params.userData.username,
        },
      });
    return {
      albums: createQueryDef("albums"),
      clubs: createQueryDef("clubs"),
      events: createQueryDef("events"),
      students: createQueryDef("students"),
    };
  }, [
    effectiveSearchInput.category,
    effectiveSearchInput.fee,
    effectiveSearchInput.query,
    effectiveSearchInput.sort,
    effectiveSearchInput.university,
    params.userData.id,
    params.userData.username,
  ]);
  const { itemsByType, projectionsByType } = useSearchProjectionScreens(searchQueryDefs);
  const searchProjection = projectionsByType[type];

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
    itemsByType,
    loadingMore: searchProjection.loadingMore,
    onRefresh,
    refreshing: searchProjection.refreshing,
    searchProjection,
  };
}
