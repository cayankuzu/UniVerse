import type { QueryKey } from "@tanstack/react-query";

export type ProjectionPrefetchSource = "idle" | "intent" | "route" | "tab" | "viewport" | "warmup";

export type ProjectionPrefetchStatus = "cache-hit" | "network";

type ProjectionPrefetchEntry = {
  recordedAt: number;
  source: ProjectionPrefetchSource;
  status: ProjectionPrefetchStatus;
};

const PREFETCH_ENTRY_TTL_MS = 3 * 60_000;

const prefetchRegistry = new Map<string, ProjectionPrefetchEntry>();

function serializeQueryKey(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

function isExpired(entry: ProjectionPrefetchEntry) {
  return Date.now() - entry.recordedAt > PREFETCH_ENTRY_TTL_MS;
}

function pruneExpiredEntries() {
  prefetchRegistry.forEach((entry, key) => {
    if (isExpired(entry)) {
      prefetchRegistry.delete(key);
    }
  });
}

export function noteProjectionPrefetch(params: {
  queryKey: QueryKey;
  source: ProjectionPrefetchSource;
  status: ProjectionPrefetchStatus;
}) {
  pruneExpiredEntries();
  prefetchRegistry.set(serializeQueryKey(params.queryKey), {
    recordedAt: Date.now(),
    source: params.source,
    status: params.status,
  });
}

export function readProjectionPrefetch(queryKey: QueryKey) {
  pruneExpiredEntries();
  const key = serializeQueryKey(queryKey);
  const entry = prefetchRegistry.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    prefetchRegistry.delete(key);
    return null;
  }
  return entry;
}

export function clearProjectionPrefetchRegistry() {
  prefetchRegistry.clear();
}
