import { AlbumAPI } from "../content/albums.api";
import { EventAPI } from "../content/events.api";
import type { CommentItem } from "../contracts/api";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "./projections.request";
import {
  mapEnvelopeItems,
  nowEnvelope,
  toCommentItem,
  tryProjectionRpc,
} from "./projections.api.helpers";

function hasCommentLikeMetadata(items: CommentItem[]) {
  return items.some(
    (item) => typeof item.likesCount === "number" || typeof item.likedByViewer === "boolean",
  );
}

export function getEventCommentsProjection(params: {
  context?: ProjectionRequestContext;
  eventId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const rpcEnvelope = await tryProjectionRpc<unknown>("event_comments_projection", {
      cursor: context.cursor || null,
      ...resolveProjectionDeltaParams(context),
      limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
      target_event_id: params.eventId,
      viewer_id: params.viewerId || null,
    });

    if (rpcEnvelope) {
      const mappedEnvelope = mapEnvelopeItems(rpcEnvelope, toCommentItem);
      if (mappedEnvelope.items.length === 0 || hasCommentLikeMetadata(mappedEnvelope.items)) {
        return mappedEnvelope;
      }
    }

    return nowEnvelope(
      await EventAPI.getComments(params.eventId, { viewerId: params.viewerId || null }),
    );
  })();
}

export function getAlbumCommentsProjection(params: {
  context?: ProjectionRequestContext;
  photoId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const rpcEnvelope = await tryProjectionRpc<unknown>("album_comments_projection", {
      cursor: context.cursor || null,
      ...resolveProjectionDeltaParams(context),
      limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
      photo_id: params.photoId,
      viewer_id: params.viewerId || null,
    });

    if (rpcEnvelope) {
      const mappedEnvelope = mapEnvelopeItems(rpcEnvelope, toCommentItem);
      if (mappedEnvelope.items.length === 0 || hasCommentLikeMetadata(mappedEnvelope.items)) {
        return mappedEnvelope;
      }
    }

    return nowEnvelope(await AlbumAPI.getPhotoComments(params.photoId));
  })();
}
