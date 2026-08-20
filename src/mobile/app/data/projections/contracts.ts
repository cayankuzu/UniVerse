import type { QueryKey } from "@tanstack/react-query";
import type { ProjectionEnvelope } from "../../data/query/contracts";
import type { ProjectionMergeMode } from "./projectionMerge";
import type { ProjectionFreshnessPolicy } from "./policies/projectionFreshness";

export type {
  CursorPageMeta,
  DeltaState,
  EntityPatch,
  MutationPatchEnvelope,
  ProjectionEnvelope,
} from "../../data/query/contracts";

export interface ProjectionFetchContext {
  cursor: string | null;
  deltaToken: string | null;
  limit: number | null;
  mode: ProjectionMergeMode;
  signal?: AbortSignal;
  since: string | null;
}

export interface ProjectionQueryOptions<T extends { id?: string }> {
  autoRefreshOnFocus?: boolean;
  /** Extended staleTime for screens with a warm persisted cache snapshot. */
  cacheWarmStaleTime?: number;
  enabled?: boolean;
  entity: string;
  fetchProjection: (context: ProjectionFetchContext) => Promise<ProjectionEnvelope<T>>;
  getId?: (item: T) => string;
  pageSize?: number;
  policy?: Partial<ProjectionFreshnessPolicy>;
  queryKey: QueryKey;
  refreshMode?: ProjectionMergeMode;
  skipIfFreshMs?: number;
  staleTime?: number;
}
