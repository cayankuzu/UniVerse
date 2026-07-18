import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { EntityPatch, MutationPatchEnvelope } from "../../data/query/contracts";
import { projectionKeys } from "./projectionKeys";

function normalizeScopePart(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function touchProjectionState(current: unknown, markStale = false) {
  if (!current || typeof current !== "object") return current;
  const row = current as Record<string, unknown>;
  if (markStale && row.isStale) {
    return row;
  }
  return {
    ...row,
    touchedAt: Date.now(),
    isStale: markStale ? true : Boolean(row.isStale),
  };
}

export function applyEntityPatches(queryClient: QueryClient, patches: EntityPatch<unknown>[]) {
  patches.forEach((patch) => {
    const id = String(patch.id || "").trim();
    const entity = String(patch.entity || "").trim();
    if (!id || !entity) return;
    queryClient.setQueryData(["entity", entity, id], (current: unknown) => {
      if (!current || typeof current !== "object") {
        return { id, ...patch.changes };
      }
      return { ...(current as Record<string, unknown>), ...patch.changes };
    });
  });
}

export function applyMutationPatchEnvelope(
  queryClient: QueryClient,
  envelope: MutationPatchEnvelope | null | undefined,
) {
  if (!envelope) return;
  if (envelope.patches?.length) {
    applyEntityPatches(queryClient, envelope.patches);
  }
  (envelope.deletedIds || []).forEach((encodedId) => {
    const raw = String(encodedId || "").trim();
    if (!raw) return;
    const [entity, id] = raw.includes(":") ? raw.split(":", 2) : ["", raw];
    if (!entity || !id) return;
    queryClient.removeQueries({ queryKey: projectionKeys.entity(entity, id), exact: true });
  });
}

export function touchProjectionQueries(queryClient: QueryClient, queryKey: QueryKey) {
  queryClient.setQueriesData({ queryKey }, (current: unknown) => touchProjectionState(current));
}

export function markProjectionStale(queryClient: QueryClient, queryKey: QueryKey) {
  queryClient.setQueriesData({ queryKey }, (current: unknown) =>
    touchProjectionState(current, true),
  );
}

export function touchProjectionScreensContainingIds(
  queryClient: QueryClient,
  params: {
    ids: string[];
    markStale?: boolean;
    screenDomains?: string[];
  },
) {
  const ids = new Set(params.ids.map(normalizeScopePart).filter(Boolean));
  if (!ids.size) return;
  const screenDomains = params.screenDomains?.length
    ? new Set(params.screenDomains.map(normalizeScopePart).filter(Boolean))
    : null;

  queryClient.getQueriesData({ queryKey: ["screen"] }).forEach(([screenKey, current]) => {
    if (!Array.isArray(screenKey)) return;
    const domain = normalizeScopePart(screenKey[1]);
    if (screenDomains && !screenDomains.has(domain)) return;
    if (!current || typeof current !== "object") return;
    const row = current as { ids?: unknown[] };
    if (!Array.isArray(row.ids) || row.ids.length === 0) return;
    const containsId = row.ids.some((value) => ids.has(normalizeScopePart(value)));
    if (!containsId) return;
    queryClient.setQueryData(screenKey, (cached: unknown) =>
      touchProjectionState(cached, params.markStale),
    );
  });
}

export function resetProjectionScope(queryClient: QueryClient, queryKey: QueryKey) {
  queryClient.removeQueries({ queryKey });
  void queryClient.refetchQueries({ queryKey, type: "active" });
}

export function hardResetProjectionScope(queryClient: QueryClient, queryKey: QueryKey) {
  resetProjectionScope(queryClient, queryKey);
}
