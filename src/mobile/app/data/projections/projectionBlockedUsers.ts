import { BlockAPI } from "../social/social.block";
import {
  mapEnvelopeItems,
  nowEnvelope,
  shouldFallbackToLegacy,
  toBlockedUserProjectionItem,
  tryProjectionRpc,
} from "./projections.api.helpers";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "./projections.request";

function hasIncrementalProjectionRequest(context: ProjectionRequestContext) {
  return Boolean(
    String(context.cursor || "").trim() ||
    String(context.deltaToken || "").trim() ||
    String(context.since || "").trim(),
  );
}

export async function getBlockedUsersProjection(params: {
  context?: ProjectionRequestContext;
  viewerId?: string;
}) {
  const context = params.context || {};
  const rpcEnvelope = await tryProjectionRpc<unknown>("blocked_users_projection", {
    cursor: context.cursor || null,
    ...resolveProjectionDeltaParams(context),
    limit_count: clampProjectionLimit(context.limit, 33, 1, 120),
    viewer_id: params.viewerId || null,
  });

  if (rpcEnvelope) return mapEnvelopeItems(rpcEnvelope, toBlockedUserProjectionItem);
  if (hasIncrementalProjectionRequest(context) || !shouldFallbackToLegacy()) {
    return nowEnvelope([]);
  }

  const items = await BlockAPI.getBlocked();
  return nowEnvelope(
    items.map((item) => ({ ...item, id: String(item.userId || item.username || "") })),
  );
}
