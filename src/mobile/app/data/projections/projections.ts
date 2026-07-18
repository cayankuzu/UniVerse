import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ProjectionEnvelope } from "../../data/query/contracts";
import { projectionKeys } from "./projectionKeys";
import {
  createProjectionScreenState,
  mergeProjectionIds,
  type ProjectionMergeMode,
  type ProjectionScreenState,
} from "./projectionMerge";

function defaultGetId<T extends { id?: string }>(item: T) {
  return String(item?.id || "").trim();
}

function normalizeId(value: string) {
  return String(value || "").trim();
}

export function serializeProjectionKey(screenKey: QueryKey) {
  return JSON.stringify(screenKey);
}

export function getProjectionState(
  queryClient: QueryClient,
  screenKey: QueryKey,
): ProjectionScreenState | null {
  return (queryClient.getQueryData(screenKey) as ProjectionScreenState | null) || null;
}

export function hasProjectionSnapshot(queryClient: QueryClient, screenKey: QueryKey) {
  return Boolean(getProjectionState(queryClient, screenKey));
}

export function applyProjectionEnvelope<T extends { id?: string }>(params: {
  entity: string;
  envelope: ProjectionEnvelope<T>;
  getId?: (item: T) => string;
  mode: ProjectionMergeMode;
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  const getId = params.getId || defaultGetId<T>;
  const current = getProjectionState(params.queryClient, params.screenKey);
  const baseItems = Array.isArray(params.envelope.items) ? params.envelope.items : [];
  const updatedItems = Array.isArray(params.envelope.updatedItems)
    ? params.envelope.updatedItems
    : [];
  const allItems = [...baseItems, ...updatedItems];

  allItems.forEach((item) => {
    const id = getId(item);
    if (!id) return;
    params.queryClient.setQueryData(projectionKeys.entity(params.entity, id), item);
  });

  const ids = mergeProjectionIds({
    currentIds: current?.ids || [],
    nextIds: baseItems.map(getId).filter(Boolean),
    updatedIds: updatedItems.map(getId).filter(Boolean),
    deletedIds: params.envelope.deletedIds || [],
    mode: params.mode,
  });

  const nextState = createProjectionScreenState({
    ids,
    nextCursor: params.envelope.nextCursor,
    serverTime: params.envelope.serverTime,
    deltaToken: params.envelope.deltaToken,
  });
  params.queryClient.setQueryData(params.screenKey, nextState);
  return nextState;
}

export function readProjectionItems<T>(
  queryClient: QueryClient,
  screenKey: QueryKey,
  entity: string,
) {
  const state = getProjectionState(queryClient, screenKey);
  if (!state?.ids?.length) return [] as T[];
  return state.ids
    .map((id) => queryClient.getQueryData(projectionKeys.entity(entity, id)) as T | undefined)
    .filter((item): item is T => Boolean(item));
}

export function readProjectionItemsByPrefix<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  entity: string,
) {
  const collected = new Map<string, T>();
  queryClient.getQueriesData({ queryKey }).forEach(([screenKey]) => {
    readProjectionItems<T>(queryClient, screenKey, entity).forEach((item) => {
      const id = String((item as T & { id?: string })?.id || "").trim();
      if (!id || collected.has(id)) return;
      collected.set(id, item);
    });
  });
  return Array.from(collected.values());
}

export function prependProjectionItem<T extends { id?: string }>(params: {
  entity: string;
  item: T;
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  const id = normalizeId(defaultGetId(params.item));
  if (!id) return null;
  params.queryClient.setQueryData(projectionKeys.entity(params.entity, id), params.item);
  const current = getProjectionState(params.queryClient, params.screenKey);
  const ids = [id, ...(current?.ids || []).filter((item) => item !== id)];
  const nextState = createProjectionScreenState({
    ids,
    nextCursor: current?.nextCursor || null,
    serverTime: current?.serverTime || new Date().toISOString(),
    deltaToken: current?.deltaToken || null,
    forceRefreshMode: current?.forceRefreshMode || null,
    isStale: current?.isStale,
  });
  params.queryClient.setQueryData(params.screenKey, nextState);
  return nextState;
}

export function replaceProjectionItemId<T extends { id?: string }>(params: {
  entity: string;
  nextItem: T;
  previousId: string;
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  const previousId = normalizeId(params.previousId);
  const nextId = normalizeId(defaultGetId(params.nextItem));
  if (!previousId || !nextId) return null;
  params.queryClient.setQueryData(projectionKeys.entity(params.entity, nextId), params.nextItem);
  params.queryClient.removeQueries({
    queryKey: projectionKeys.entity(params.entity, previousId),
    exact: true,
  });
  const current = getProjectionState(params.queryClient, params.screenKey);
  if (!current) return null;
  const ids = current.ids.map((item) => (item === previousId ? nextId : item));
  const dedupedIds = Array.from(new Set(ids.filter(Boolean)));
  const nextState = createProjectionScreenState({
    ids: dedupedIds,
    nextCursor: current.nextCursor,
    serverTime: current.serverTime,
    deltaToken: current.deltaToken,
    forceRefreshMode: current.forceRefreshMode || null,
    isStale: current.isStale,
  });
  params.queryClient.setQueryData(params.screenKey, nextState);
  return nextState;
}

export function removeProjectionItemIds(params: {
  entity?: string;
  ids: string[];
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  const deletedSet = new Set(params.ids.map((item) => normalizeId(item)).filter(Boolean));
  if (!deletedSet.size) return null;
  if (params.entity) {
    deletedSet.forEach((id) => {
      params.queryClient.removeQueries({
        queryKey: projectionKeys.entity(params.entity!, id),
        exact: true,
      });
    });
  }
  const current = getProjectionState(params.queryClient, params.screenKey);
  if (!current) return null;
  const nextState = createProjectionScreenState({
    ids: current.ids.filter((item) => !deletedSet.has(item)),
    nextCursor: current.nextCursor,
    serverTime: current.serverTime,
    deltaToken: current.deltaToken,
    forceRefreshMode: current.forceRefreshMode || null,
    isStale: current.isStale,
  });
  params.queryClient.setQueryData(params.screenKey, nextState);
  return nextState;
}
