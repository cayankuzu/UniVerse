import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  applyProjectionEnvelope,
  getProjectionState,
  readProjectionItems,
} from "../../../data/projections";

export function readProjectionListCache<T>(params: {
  entity: string;
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  return {
    hasSnapshot: Boolean(getProjectionState(params.queryClient, params.screenKey)),
    items: readProjectionItems<T>(params.queryClient, params.screenKey, params.entity),
  };
}

export function writeProjectionListCache<T extends { id?: string }>(params: {
  entity: string;
  items: T[];
  queryClient: QueryClient;
  screenKey: QueryKey;
}) {
  applyProjectionEnvelope({
    entity: params.entity,
    envelope: {
      deletedIds: [],
      deltaToken: null,
      items: params.items,
      nextCursor: null,
      serverTime: new Date().toISOString(),
      updatedItems: [],
    },
    mode: "replace",
    queryClient: params.queryClient,
    screenKey: params.screenKey,
  });
}
