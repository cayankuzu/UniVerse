import type { SearchUserResult } from "../contracts/api";
import { AlbumAPI } from "../content/albums.api";
import { EventAPI } from "../content/events.api";
import { normalizeSearchUserResult } from "../normalizers/searchUsers";
import type { ProjectionEnvelope } from "../query/contracts";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedSearchUsers,
  loadViewerBlockedVisibility,
  type BlockedVisibilitySnapshot,
} from "../social/blockedVisibility";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "./projections.request";
import { mapEnvelopeItems, nowEnvelope, tryProjectionRpc } from "./projections.api.helpers";

async function resolveBlockedVisibility(viewerId?: string) {
  return viewerId ? loadViewerBlockedVisibility(viewerId) : createEmptyBlockedVisibilitySnapshot();
}

function filterSearchUserEnvelope(
  envelope: ProjectionEnvelope<SearchUserResult>,
  blockedVisibility: BlockedVisibilitySnapshot,
) {
  return {
    ...envelope,
    items: filterBlockedSearchUsers(envelope.items || [], blockedVisibility),
    updatedItems: filterBlockedSearchUsers(envelope.updatedItems || [], blockedVisibility),
  };
}

export function getEventLikersProjection(params: {
  context?: ProjectionRequestContext;
  eventId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const [rpcEnvelope, blockedVisibility] = await Promise.all([
      tryProjectionRpc<unknown>("event_likers_projection", {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
        target_event_id: params.eventId,
        viewer_id: params.viewerId || null,
      }),
      resolveBlockedVisibility(params.viewerId),
    ]);

    if (rpcEnvelope) {
      return filterSearchUserEnvelope(
        mapEnvelopeItems(rpcEnvelope, normalizeSearchUserResult),
        blockedVisibility,
      );
    }

    return nowEnvelope(
      filterBlockedSearchUsers(await EventAPI.getLikes(params.eventId), blockedVisibility),
    );
  })();
}

export function getEventAttendeesProjection(params: {
  context?: ProjectionRequestContext;
  eventId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const [rpcEnvelope, blockedVisibility] = await Promise.all([
      tryProjectionRpc<unknown>("event_attendees_projection", {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
        target_event_id: params.eventId,
        viewer_id: params.viewerId || null,
      }),
      resolveBlockedVisibility(params.viewerId),
    ]);

    if (rpcEnvelope) {
      const mappedEnvelope = filterSearchUserEnvelope(
        mapEnvelopeItems(rpcEnvelope, normalizeSearchUserResult),
        blockedVisibility,
      );
      if (mappedEnvelope.items.length > 0 || (mappedEnvelope.updatedItems || []).length > 0) {
        return mappedEnvelope;
      }
      const legacyItems = filterBlockedSearchUsers(
        await EventAPI.getAttendees(params.eventId),
        blockedVisibility,
      );
      return legacyItems.length > 0 ? nowEnvelope(legacyItems) : mappedEnvelope;
    }

    return nowEnvelope(
      filterBlockedSearchUsers(await EventAPI.getAttendees(params.eventId), blockedVisibility),
    );
  })();
}

export function getEventCommentLikersProjection(params: {
  commentId: string;
  context?: ProjectionRequestContext;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const [rpcEnvelope, blockedVisibility] = await Promise.all([
      tryProjectionRpc<unknown>("event_comment_likers_projection", {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
        target_comment_id: params.commentId,
        viewer_id: params.viewerId || null,
      }),
      resolveBlockedVisibility(params.viewerId),
    ]);

    if (rpcEnvelope) {
      return filterSearchUserEnvelope(
        mapEnvelopeItems(rpcEnvelope, normalizeSearchUserResult),
        blockedVisibility,
      );
    }

    return nowEnvelope(
      filterBlockedSearchUsers(await EventAPI.getCommentLikes(params.commentId), blockedVisibility),
    );
  })();
}

export function getAlbumCommentLikersProjection(params: {
  commentId: string;
  context?: ProjectionRequestContext;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const [rpcEnvelope, blockedVisibility] = await Promise.all([
      tryProjectionRpc<unknown>("album_comment_likers_projection", {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
        target_comment_id: params.commentId,
        viewer_id: params.viewerId || null,
      }),
      resolveBlockedVisibility(params.viewerId),
    ]);

    if (rpcEnvelope) {
      return filterSearchUserEnvelope(
        mapEnvelopeItems(rpcEnvelope, normalizeSearchUserResult),
        blockedVisibility,
      );
    }

    return nowEnvelope(
      filterBlockedSearchUsers(
        await AlbumAPI.getPhotoCommentLikes(params.commentId),
        blockedVisibility,
      ),
    );
  })();
}

export function getAlbumPhotoLikersProjection(params: {
  context?: ProjectionRequestContext;
  photoId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  return (async () => {
    const [rpcEnvelope, blockedVisibility] = await Promise.all([
      tryProjectionRpc<unknown>("album_photo_likers_projection", {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33, 1, 80),
        target_photo_id: params.photoId,
        viewer_id: params.viewerId || null,
      }),
      resolveBlockedVisibility(params.viewerId),
    ]);

    if (rpcEnvelope) {
      return filterSearchUserEnvelope(
        mapEnvelopeItems(rpcEnvelope, normalizeSearchUserResult),
        blockedVisibility,
      );
    }

    return nowEnvelope(
      filterBlockedSearchUsers(await AlbumAPI.getPhotoLikes(params.photoId), blockedVisibility),
    );
  })();
}
