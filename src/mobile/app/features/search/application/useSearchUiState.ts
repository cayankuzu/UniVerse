import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useScrollToTopOnReselect } from "../../../shared/hooks/useScrollToTopOnReselect";
import type { AppFlatListRef } from "../../../shared/components";
import { useAutoClearingMessage } from "../../../shared/hooks/useAutoClearingMessage";
import type { SortOption, SearchType } from "../domain/types";
import type { AlbumPhotoWithMeta, EventWithMeta, SearchUserResult } from "../data/searchTypes";
import {
  clampSearchValue,
  getActiveSearchFilterCount,
  SEARCH_FILTER_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
} from "../domain/searchResults.helpers";
import { getCachedWarmupPreferences, SEARCH_DISCOVERY_SCOPE } from "../data";
import { useSearchRequestDebounce } from "./useSearchRequestDebounce";
import { useSearchScopeRestore } from "./useSearchScopeRestore";

interface UseSearchUiStateParams {
  searchReselectCounter: number;
  viewerKey: string;
}

type SearchListItem = AlbumPhotoWithMeta | EventWithMeta | SearchUserResult;

function normalizePersistedSortOption(value: string | undefined): SortOption {
  const normalized = String(value || "").trim();
  return normalized ? (normalized as SortOption) : "newest";
}

export function useSearchUiState({ searchReselectCounter, viewerKey }: UseSearchUiStateParams) {
  const cachedSearchScope = getCachedWarmupPreferences(viewerKey).lastSearchScope;
  const [type, setType] = useState<SearchType>(cachedSearchScope?.kind || "albums");
  const [query, setQuery] = useState(cachedSearchScope?.queryText || "");
  const [selectedCategory, setSelectedCategory] = useState(cachedSearchScope?.categoryFilter || "");
  const [selectedUniversity, setSelectedUniversity] = useState(
    cachedSearchScope?.universityFilter || "",
  );
  const [selectedFee, setSelectedFee] = useState<"" | "free" | "paid">(
    cachedSearchScope?.feeFilter === "free" || cachedSearchScope?.feeFilter === "paid"
      ? cachedSearchScope.feeFilter
      : "",
  );
  const [sortOption, setSortOption] = useState<SortOption>(
    normalizePersistedSortOption(cachedSearchScope?.sortMode),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewerType, setViewerType] = useState<"events" | "albums" | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const { message: warningMessage, setMessage: setWarningMessage } = useAutoClearingMessage();
  const listRef = useRef<AppFlatListRef<SearchListItem> | null>(null);

  const deferredQuery = useDeferredValue(query);
  const deferredCategory = useDeferredValue(selectedCategory);
  const deferredUniversity = useDeferredValue(selectedUniversity);
  const deferredFee = useDeferredValue(selectedFee);
  const deferredSortOption = useDeferredValue(sortOption);
  const normalizedQuery = useMemo(
    () => clampSearchValue(deferredQuery.trim(), SEARCH_QUERY_MAX_LENGTH),
    [deferredQuery],
  );
  const normalizedCategory = useMemo(
    () => clampSearchValue(deferredCategory, SEARCH_FILTER_MAX_LENGTH),
    [deferredCategory],
  );
  const normalizedUniversity = useMemo(
    () => clampSearchValue(deferredUniversity, SEARCH_FILTER_MAX_LENGTH),
    [deferredUniversity],
  );
  const { debouncedInput, debouncedScope: searchScope } = useSearchRequestDebounce({
    category: normalizedCategory,
    fee: deferredFee,
    query: normalizedQuery,
    sort: deferredSortOption,
    university: normalizedUniversity,
  });
  const hasDebouncedSearchIntent = Boolean(
    debouncedInput.query ||
    debouncedInput.category ||
    debouncedInput.university ||
    debouncedInput.fee ||
    debouncedInput.sort !== "newest",
  );
  const effectiveSearchInput = hasDebouncedSearchIntent
    ? debouncedInput
    : { category: "", fee: "" as const, query: "", sort: "newest", university: "" };
  const effectiveSearchScope = hasDebouncedSearchIntent ? searchScope : SEARCH_DISCOVERY_SCOPE;
  const supportsFilters = true;
  const isUserGridType = type === "clubs" || type === "students";
  const hasSearchIntent = Boolean(
    normalizedQuery ||
    normalizedCategory ||
    normalizedUniversity ||
    deferredFee ||
    deferredSortOption !== "newest",
  );
  const isSearchRequestPending =
    normalizedQuery !== debouncedInput.query ||
    normalizedCategory !== debouncedInput.category ||
    normalizedUniversity !== debouncedInput.university ||
    deferredFee !== debouncedInput.fee ||
    deferredSortOption !== debouncedInput.sort;

  const applyPersistedScope = useCallback(
    (nextSearchScope: ReturnType<typeof getCachedWarmupPreferences>["lastSearchScope"]) => {
      startTransition(() => {
        setType(nextSearchScope?.kind || "albums");
        setQuery(nextSearchScope?.queryText || "");
        setSelectedCategory(nextSearchScope?.categoryFilter || "");
        setSelectedUniversity(nextSearchScope?.universityFilter || "");
        setSelectedFee(
          nextSearchScope?.feeFilter === "free" || nextSearchScope?.feeFilter === "paid"
            ? nextSearchScope.feeFilter
            : "",
        );
        setSortOption(normalizePersistedSortOption(nextSearchScope?.sortMode));
        setShowFilters(false);
        setViewerType(null);
        setViewerIndex(0);
      });
    },
    [],
  );

  const { persistedSearchScopeRef, restoreReady } = useSearchScopeRestore({
    applyPersistedScope,
    viewerKey,
  });

  useScrollToTopOnReselect({
    listRef,
    onReselect: () => setViewerType(null),
    reselectCounter: searchReselectCounter,
  });

  const activeFilterCount = getActiveSearchFilterCount({
    selectedCategory,
    selectedFee,
    selectedUniversity,
    sortOption,
    type,
  });

  const onSelectType = (value: SearchType) => {
    startTransition(() => {
      setType(value);
      setShowFilters(false);
      setSelectedCategory("");
      setSelectedUniversity("");
      setSelectedFee("");
      setSortOption("newest");
    });
  };

  return {
    activeFilterCount,
    debouncedInput,
    effectiveSearchInput,
    effectiveSearchScope,
    hasDebouncedSearchIntent,
    hasSearchIntent,
    isUserGridType,
    isSearchRequestPending,
    listRef,
    normalizedCategory,
    normalizedQuery,
    normalizedUniversity,
    onSelectType,
    persistedSearchScopeRef,
    query,
    restoreReady,
    searchScope,
    selectedCategory,
    selectedFee,
    selectedUniversity,
    setQuery: (value: string) => setQuery(clampSearchValue(value, SEARCH_QUERY_MAX_LENGTH)),
    setSelectedCategory: (value: string) =>
      setSelectedCategory(clampSearchValue(value, SEARCH_FILTER_MAX_LENGTH)),
    setSelectedFee,
    setSelectedUniversity: (value: string) =>
      setSelectedUniversity(clampSearchValue(value, SEARCH_FILTER_MAX_LENGTH)),
    setShowFilters,
    setSortOption,
    setViewerIndex,
    setViewerType,
    setWarningMessage,
    showFilters,
    sortOption,
    supportsFilters,
    type,
    viewerIndex,
    viewerType,
    warningMessage,
  };
}
