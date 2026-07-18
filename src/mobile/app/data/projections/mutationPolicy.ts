import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { EntityPatch } from "../../data/query/contracts";
import {
  applyEntityPatches,
  markProjectionStale,
  resetProjectionScope,
  touchProjectionQueries,
} from "./patchEnvelope";
import { refreshProjectionScope, replaceProjectionScope } from "./projectionRefresh";

export interface MutationRefreshPolicy {
  invalidateKeys?: QueryKey[];
  replaceKeys?: QueryKey[];
  refreshKeys?: QueryKey[];
  resetKeys?: QueryKey[];
  staleKeys?: QueryKey[];
  touchKeys?: QueryKey[];
}

export interface MutationEntityPatchSet {
  deletedIds?: string[];
  patches?: EntityPatch<unknown>[];
}

export interface SocialMutationResult extends MutationEntityPatchSet {
  followState?: {
    next: "none" | "requested" | "following";
    previous: "none" | "requested" | "following";
  };
  refreshPolicy?: MutationRefreshPolicy;
}

export interface ContentMutationResult extends MutationEntityPatchSet {
  refreshPolicy?: MutationRefreshPolicy;
}

function getUniqueQueryKeys(keys: QueryKey[] | undefined) {
  if (!keys?.length) return [];
  const seen = new Set<string>();
  const uniqueKeys: QueryKey[] = [];
  keys.forEach((queryKey) => {
    const dedupeKey = JSON.stringify(queryKey);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    uniqueKeys.push(queryKey);
  });
  return uniqueKeys;
}

function applyPolicyQueryKeys(keys: QueryKey[] | undefined, apply: (queryKey: QueryKey) => void) {
  getUniqueQueryKeys(keys).forEach(apply);
}

export function applyMutationRefreshPolicy(
  queryClient: QueryClient,
  policy: MutationRefreshPolicy | null | undefined,
) {
  if (!policy) return;
  applyPolicyQueryKeys(policy.touchKeys, (queryKey) => {
    touchProjectionQueries(queryClient, queryKey);
  });
  applyPolicyQueryKeys(policy.staleKeys, (queryKey) => {
    markProjectionStale(queryClient, queryKey);
  });
  applyPolicyQueryKeys(policy.replaceKeys, (queryKey) => {
    replaceProjectionScope(queryClient, queryKey);
  });
  applyPolicyQueryKeys(policy.refreshKeys, (queryKey) => {
    refreshProjectionScope(queryClient, queryKey);
  });
  applyPolicyQueryKeys(policy.invalidateKeys, (queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  });
  applyPolicyQueryKeys(policy.resetKeys, (queryKey) => {
    resetProjectionScope(queryClient, queryKey);
  });
}

export function applyMutationResult(
  queryClient: QueryClient,
  result: MutationEntityPatchSet & { refreshPolicy?: MutationRefreshPolicy },
) {
  if (result.patches?.length) {
    applyEntityPatches(queryClient, result.patches);
  }
  applyMutationRefreshPolicy(queryClient, result.refreshPolicy);
}
