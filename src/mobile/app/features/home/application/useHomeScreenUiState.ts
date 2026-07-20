import { startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";
import { useAutoClearingMessage } from "../../../shared/hooks/useAutoClearingMessage";
import { useTransitionSetter } from "../../../shared/hooks/useTransitionSetter";
import type { HomeFeedItem } from "../data";
import { getCachedWarmupPreferences, loadPersistedWarmupPreferences } from "../data";
import { normalizeHomeSortOption } from "./homeSortPolicy";

export type SourceFilter = "all" | "following" | "own";
export type TypeFilter = "all" | "events" | "albums";
export type EntityFilter = "all" | "clubs" | "students";
export type SortOption = "newest" | "oldest";

const DEFAULT_SOURCE_FILTER: SourceFilter = "all";
const DEFAULT_TYPE_FILTER: TypeFilter = "all";
const DEFAULT_ENTITY_FILTER: EntityFilter = "all";
const DEFAULT_SORT_OPTION: SortOption = "newest";

type UseHomeScreenUiStateParams = {
  viewerKey: string;
};

export function useHomeScreenUiState(params: UseHomeScreenUiStateParams) {
  const { viewerKey } = params;
  const cachedHomeScope = getCachedWarmupPreferences(viewerKey).lastHomeScope;
  const [sourceFilter, setSourceFilterState] = useState<SourceFilter>(
    cachedHomeScope?.sourceFilter || DEFAULT_SOURCE_FILTER,
  );
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>(
    cachedHomeScope?.typeFilter || DEFAULT_TYPE_FILTER,
  );
  const [entityFilter, setEntityFilterState] = useState<EntityFilter>(
    cachedHomeScope?.entityFilter || DEFAULT_ENTITY_FILTER,
  );
  const [sortOption, setSortOptionState] = useState<SortOption>(
    normalizeHomeSortOption(cachedHomeScope?.sortOption),
  );
  const [showFilters, setShowFiltersState] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [restoreReady, setRestoreReady] = useState(Boolean(cachedHomeScope));
  const { message: warningMessage, setMessage: setWarningMessage } = useAutoClearingMessage();
  const listRef = useRef<FlatList<HomeFeedItem> | null>(null);

  const deferredSourceFilter = useDeferredValue(sourceFilter);
  const deferredTypeFilter = useDeferredValue(typeFilter);
  const deferredEntityFilter = useDeferredValue(entityFilter);
  const deferredSortOption = useDeferredValue(sortOption);

  useEffect(() => {
    setRestoreReady(Boolean(getCachedWarmupPreferences(viewerKey).lastHomeScope));
  }, [viewerKey]);

  useEffect(() => {
    setHasUserInteracted(false);
  }, [viewerKey]);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedWarmupPreferences(viewerKey).then((preferences) => {
      if (cancelled) return;
      const nextHomeScope = preferences.lastHomeScope;
      startTransition(() => {
        if (nextHomeScope) {
          setSourceFilterState(nextHomeScope.sourceFilter);
          setTypeFilterState(nextHomeScope.typeFilter);
          setEntityFilterState(nextHomeScope.entityFilter);
          setSortOptionState(normalizeHomeSortOption(nextHomeScope.sortOption));
        }
        setRestoreReady(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [viewerKey]);

  const activeFilterCount = [
    sourceFilter !== DEFAULT_SOURCE_FILTER ? sourceFilter : "",
    typeFilter !== DEFAULT_TYPE_FILTER ? typeFilter : "",
    entityFilter !== DEFAULT_ENTITY_FILTER ? entityFilter : "",
    sortOption !== DEFAULT_SORT_OPTION ? sortOption : "",
  ].filter(Boolean).length;
  const markUserInteracted = useCallback(() => {
    setHasUserInteracted((current) => current || true);
  }, []);

  return {
    activeFilterCount,
    defaultSource: DEFAULT_SOURCE_FILTER,
    deferredEntityFilter,
    deferredSortOption,
    deferredSourceFilter,
    deferredTypeFilter,
    entityFilter,
    hasUserInteracted,
    listRef,
    markUserInteracted,
    restoreReady,
    setEntityFilter: useTransitionSetter(setEntityFilterState),
    setShowFilters: setShowFiltersState,
    setSortOption: useTransitionSetter(setSortOptionState),
    setSourceFilter: useTransitionSetter(setSourceFilterState),
    setTypeFilter: useTransitionSetter(setTypeFilterState),
    setViewerIndex,
    setWarningMessage,
    showFilters,
    sortOption,
    sourceFilter,
    typeFilter,
    viewerIndex,
    warningMessage,
  };
}
