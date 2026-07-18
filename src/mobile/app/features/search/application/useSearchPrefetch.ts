import { useMemo } from "react";
import { useNextPageImagePrefetch } from "../../../data/projections/prefetch/useNextPageImagePrefetch";
import { usePriorityImagePrefetch } from "../../../data/projections/prefetch/usePriorityImagePrefetch";
import { useContentIntentPrefetch } from "../../../data/projections/prefetch/useContentIntentPrefetch";
import {
  useViewportPrefetch,
  type ViewportPrefetchTarget,
} from "../../../data/projections/prefetch/useViewportPrefetch";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { SearchType } from "../domain/types";

type SearchPrefetchItem = {
  clubUsername?: string;
  eventId?: string;
  id?: string;
  username?: string;
};

type UseSearchPrefetchParams = {
  activeSearchItems: unknown[];
  effectiveSearchScope: string;
  loadingMore: boolean;
  refreshing: boolean;
  searchProjectionFetching: boolean;
  searchType: SearchType;
  userData: AuthUserData;
  viewerKey: string;
};

function normalizePrefetchValue(value: string | undefined | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function useSearchPrefetch(params: UseSearchPrefetchParams) {
  const disablePrefetch =
    params.refreshing || params.searchProjectionFetching || params.loadingMore;

  useNextPageImagePrefetch({
    disabled: disablePrefetch,
    items: params.activeSearchItems,
    screenKey: `search:${params.viewerKey}:${params.searchType}:${params.effectiveSearchScope}`,
    tier: "tier1",
  });

  usePriorityImagePrefetch({
    disabled: disablePrefetch,
    items: params.activeSearchItems,
    scopeKey: `${params.searchType}:${params.effectiveSearchScope}:top-fold`,
    tier: "tier1",
  });

  const resolvePrefetchTargets = useMemo(() => {
    const searchType = params.searchType;
    return (item: unknown) => {
      const record = item && typeof item === "object" ? (item as SearchPrefetchItem) : {};
      const targets: ViewportPrefetchTarget[] = [];
      if (searchType === "events") {
        const eventId = normalizePrefetchValue(record.id);
        if (eventId) targets.push({ type: "event", id: eventId });
        const clubUsername = normalizePrefetchValue(record.clubUsername);
        if (clubUsername) targets.push({ type: "profile", username: clubUsername });
      } else if (searchType === "albums") {
        const eventId = normalizePrefetchValue(record.eventId);
        if (eventId) targets.push({ type: "event", id: eventId });
      } else {
        const username = normalizePrefetchValue(record.username);
        if (username) targets.push({ type: "profile", username });
      }
      return targets;
    };
  }, [params.searchType]);

  const viewportPrefetch = useViewportPrefetch({
    disabled: disablePrefetch,
    resolvePrefetchTargets,
    scopeKey: `${params.searchType}:${params.effectiveSearchScope}`,
    tier: "tier1",
    viewerKey: params.viewerKey,
    viewerUserId: params.userData.id,
    viewerUsername: params.userData.username,
  });

  const { prefetchEventById, prefetchProfileByUsername } = useContentIntentPrefetch({
    id: params.userData.id,
    username: params.userData.username,
  });

  return {
    prefetchEventById,
    prefetchProfileByUsername,
    viewportPrefetch,
  };
}
