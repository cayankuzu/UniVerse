import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  logProjectionDuplicateRequest,
  startProjectionLoadMoreTimer,
} from "../projectionScreenTelemetry";
import { getProjectionState } from "../projections";
import type { ProjectionMergeMode, ProjectionScreenState } from "../projectionMerge";

export interface UseProjectionLoadMoreParams {
  entity: string;
  queryClient: QueryClient;
  queryScope: string;
  stableQueryKey: QueryKey;
  syncProjection: (mode: ProjectionMergeMode) => Promise<ProjectionScreenState | null | undefined>;
}

export function useProjectionLoadMore({
  entity,
  queryClient,
  queryScope,
  stableQueryKey,
  syncProjection,
}: UseProjectionLoadMoreParams) {
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMorePromiseRef = useRef<Promise<ProjectionScreenState | null | undefined> | null>(null);

  // Reset load-more state when the query scope changes.
  useEffect(() => {
    setLoadingMore(false);
    loadMorePromiseRef.current = null;
  }, [queryScope]);

  const loadMore = useCallback(() => {
    const current = getProjectionState(queryClient, stableQueryKey);
    if (!current?.nextCursor) {
      if (current?.isStale) {
        if (loadMorePromiseRef.current) return loadMorePromiseRef.current;
        setLoadingMore(true);
        const staleRefreshPromise = syncProjection("replace").finally(() => {
          setLoadingMore(false);
          if (loadMorePromiseRef.current === staleRefreshPromise) {
            loadMorePromiseRef.current = null;
          }
        });
        loadMorePromiseRef.current = staleRefreshPromise;
        return staleRefreshPromise;
      }
      return Promise.resolve(current);
    }
    if (loadMorePromiseRef.current) {
      logProjectionDuplicateRequest({
        entity,
        reason: "load-more-joined-in-flight",
        screenKey: queryScope,
      });
      return loadMorePromiseRef.current;
    }
    const stopLoadMoreTelemetry = startProjectionLoadMoreTimer({
      entity,
      screenKey: queryScope,
    });
    setLoadingMore(true);
    const loadMorePromise = syncProjection("append")
      .then((nextState) => {
        stopLoadMoreTelemetry("ok", {
          itemCount: nextState?.ids?.length || 0,
        });
        return nextState;
      })
      .catch((error) => {
        stopLoadMoreTelemetry("error", {
          message: String((error as { message?: string })?.message || error || ""),
        });
        throw error;
      })
      .finally(() => {
        setLoadingMore(false);
        if (loadMorePromiseRef.current === loadMorePromise) {
          loadMorePromiseRef.current = null;
        }
      });
    loadMorePromiseRef.current = loadMorePromise;
    return loadMorePromise;
  }, [entity, queryClient, queryScope, stableQueryKey, syncProjection]);

  return { loadMore, loadingMore };
}
