import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ProjectionEnvelope } from "../../query/contracts";
import { runLowPriorityTask } from "../../../shared/utils/lowPriorityTaskScheduler";
import { applyProjectionEnvelope } from "../projections";
import { noteProjectionPrefetch, type ProjectionPrefetchSource } from "./prefetchRegistry";

function isUserInitiatedPrefetch(source: ProjectionPrefetchSource) {
  return source === "intent" || source === "route" || source === "tab";
}

export function runProjectionPrefetchTask<T>(params: {
  key: string;
  source: ProjectionPrefetchSource;
  task: () => Promise<T> | T;
}) {
  if (!isUserInitiatedPrefetch(params.source)) {
    return runLowPriorityTask(params.task, { key: params.key });
  }

  try {
    return Promise.resolve(params.task());
  } catch (error) {
    return Promise.reject(error);
  }
}

function hasFreshQueryData(params: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  staleTime: number;
}) {
  const state = params.queryClient.getQueryState(params.queryKey);
  if (!state || state.status !== "success" || !state.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt <= Math.max(0, params.staleTime);
}

export async function prefetchProjectionScreen<T extends { id?: string }>(params: {
  entity: string;
  fetchProjection: (signal?: AbortSignal) => Promise<ProjectionEnvelope<T>>;
  getId?: (item: T) => string;
  queryClient: QueryClient;
  queryKey: QueryKey;
  source?: ProjectionPrefetchSource;
  staleTime?: number;
}) {
  const {
    entity,
    fetchProjection,
    getId,
    queryClient,
    queryKey,
    source = "intent",
    staleTime = 30_000,
  } = params;
  if (
    staleTime > 0 &&
    hasFreshQueryData({
      queryClient,
      queryKey,
      staleTime,
    })
  ) {
    noteProjectionPrefetch({
      queryKey,
      source,
      status: "cache-hit",
    });
    return;
  }
  return runProjectionPrefetchTask({
    key: `projection-prefetch:${JSON.stringify(queryKey)}`,
    source,
    task: () =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: async ({ signal }) => {
          const envelope = await fetchProjection(signal);
          const nextState = applyProjectionEnvelope({
            entity,
            envelope,
            getId,
            mode: "replace",
            queryClient,
            screenKey: queryKey,
          });
          noteProjectionPrefetch({
            queryKey,
            source,
            status: "network",
          });
          return nextState;
        },
        staleTime,
      }),
  });
}
