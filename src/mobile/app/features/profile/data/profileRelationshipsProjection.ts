import type { ProjectionEnvelope } from "../../../data/query/contracts";
import {
  fetchRelationshipRows,
  nowEnvelope,
  tryProjectionRpc,
} from "../../../data/projections/projections.api.helpers";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "../../../data/projections/projections.request";
import type { RelationshipProjectionItem } from "../../../data/projections/projections.types";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedProfiles,
  loadViewerBlockedVisibility,
} from "../../../data/social/blockedVisibility";

export async function getRelationshipsProjection(params: {
  context?: ProjectionRequestContext;
  kind: "followers" | "following";
  username: string;
  viewerId?: string;
}): Promise<ProjectionEnvelope<RelationshipProjectionItem>> {
  const context = params.context || {};
  const [rpcEnvelope, blockedVisibility] = await Promise.all([
    tryProjectionRpc<RelationshipProjectionItem>("relationship_list_projection", {
      cursor: context.cursor || null,
      ...resolveProjectionDeltaParams(context),
      kind_name: params.kind,
      limit_count: clampProjectionLimit(context.limit, 33, 1, 120),
      target_username: params.username,
      viewer_id: params.viewerId || null,
    }),
    params.viewerId
      ? loadViewerBlockedVisibility(params.viewerId)
      : Promise.resolve(createEmptyBlockedVisibilitySnapshot()),
  ]);
  if (rpcEnvelope) {
    return {
      ...rpcEnvelope,
      items: filterBlockedProfiles(rpcEnvelope.items || [], blockedVisibility),
    };
  }
  return nowEnvelope(
    filterBlockedProfiles(
      await fetchRelationshipRows(params.username, params.kind),
      blockedVisibility,
    ),
  );
}
