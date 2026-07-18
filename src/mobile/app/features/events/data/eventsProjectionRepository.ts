/**
 * Events Repository — Single source of truth for event detail and album data.
 *
 * DATA LAYER: Owns event detail projections, album event data, and upload availability.
 *
 * Flow: ProjectionAPI → eventsRepository → ViewModel → UI
 */
import type { QueryClient } from "@tanstack/react-query";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { deleteAlbumPhoto as deleteAlbumPhotoInteraction } from "../../../data/content/albums.interactions";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { filterAlbumsBySurfaceContext } from "../../../data/normalizers/albums";
import type { ProjectionFetchContext } from "../../../data/projections/contracts";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { AlbumAPI } from "./remote/albums.api";
import { getAlbumUploadAvailability } from "./remote/albums.upload";
import type {
  AlbumEventProjectionItem,
  EventDetailProjection,
} from "../../../data/projections/projections.types";
import type { ProjectionRequestContext } from "../../../data/projections/projections.request";
import { ReportAPI } from "../../../data/normalizers/reports";
import { ProjectionAPI } from "../../../data/projections/projections.shared";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  STALE_TIMES,
  PAGE_SIZES,
} from "../../../data/projections/cacheConfig";
import { EVENT_DETAIL_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import type { ViewerContext } from "../../../data/projections/viewerContext";

// ─── Fetch Functions ────────────────────────────────────────────────────────

export function fetchEventDetail(
  eventId: string,
  viewerId?: string,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<EventDetailProjection>> {
  return ProjectionAPI.getEventDetail(eventId, viewerId, context);
}

export function fetchAlbumEvent(
  eventId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
): Promise<ProjectionEnvelope<AlbumEventProjectionItem>> {
  return ProjectionAPI.getAlbumEvent(eventId, context, viewerId);
}

export async function fetchNotificationTargetAlbumPhoto(
  eventId: string,
  photoId: string,
): Promise<AlbumPhotoWithMeta | null> {
  const normalizedPhotoId = String(photoId || "")
    .trim()
    .toLowerCase();
  if (!eventId || !normalizedPhotoId) return null;

  const eventScopedPhotos = await AlbumAPI.getEventPhotos(eventId);
  const eventScopedMatch = eventScopedPhotos.find(
    (item) =>
      String(item.id || "")
        .trim()
        .toLowerCase() === normalizedPhotoId,
  );
  if (eventScopedMatch) {
    return eventScopedMatch;
  }

  const fallbackPhotos = filterAlbumsBySurfaceContext(
    await AlbumAPI.getVisibleByEventIds([eventId]),
    "event_album",
  );
  return (
    fallbackPhotos.find(
      (item) =>
        String(item.id || "")
          .trim()
          .toLowerCase() === normalizedPhotoId,
    ) || null
  );
}

export async function fetchAlbumUploadAvailability(eventId: string, viewerId: string) {
  return getAlbumUploadAvailability(eventId, viewerId);
}

export function readOptimisticEventDetail(queryClient: QueryClient, eventId: string) {
  const optimisticDetail = queryClient.getQueryData(
    projectionKeys.entity("event-detail", eventId),
  ) as EventDetailProjection | null;
  const optimisticProfileEvent = queryClient.getQueryData(
    projectionKeys.entity("profile-events", eventId),
  ) as EventWithMeta | null;
  const optimisticHomeItem = queryClient.getQueryData(
    projectionKeys.entity("home-feed", `event:${eventId}`),
  ) as { event?: EventWithMeta } | null;
  const optimisticEvent =
    optimisticDetail?.event || optimisticProfileEvent || optimisticHomeItem?.event || null;

  return {
    optimisticDetail,
    optimisticEvent,
  };
}

// ─── Album Mutations ────────────────────────────────────────────────────────

export function deleteAlbumPhoto(photoId: string) {
  return deleteAlbumPhotoInteraction(photoId);
}

export function likeAlbumPhoto(photoId: string) {
  return AlbumAPI.likePhoto(photoId);
}

export async function getAlbumPhotoLikes(photoId: string, viewerId?: string) {
  const rows = await ProjectionAPI.getAlbumPhotoLikers(photoId, {}, viewerId);
  return Array.isArray(rows.items) ? rows.items : [];
}

export function toggleAlbumCommentLike(
  commentId: string,
  options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
) {
  return AlbumAPI.togglePhotoCommentLike(commentId, options);
}

export function deleteAlbumComment(photoId: string, commentId: string) {
  return AlbumAPI.deletePhotoComment(photoId, commentId);
}

export function fetchAlbumComments(
  photoId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumComments(photoId, context, viewerId);
}

export function fetchAlbumCommentLikers(
  commentId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumCommentLikers(commentId, context, viewerId);
}

export function fetchAlbumPhotoLikers(
  photoId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumPhotoLikers(photoId, context, viewerId);
}

export function reportAlbum(params: { photoId: string; username: string }) {
  return ReportAPI.submit({
    reason: "Uygunsuz albüm",
    targetId: params.photoId,
    targetType: "album",
    targetUsername: params.username,
  });
}

export function reportAlbumComment(params: { commentId: string; username: string }) {
  return ReportAPI.submit({
    reason: "Uygunsuz yorum",
    targetId: params.commentId,
    targetType: "album_comment",
    targetUsername: params.username,
  });
}

// ─── Query Definitions ──────────────────────────────────────────────────────

export function getEventDetailQueryDef(params: { eventId: string; viewer: ViewerContext }) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    entity: "event-detail" as const,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchEventDetail(params.eventId, params.viewer.id, {
        cursor,
        deltaToken,
        limit: limit ?? PAGE_SIZES.eventDetail,
        since,
      }),
    pageSize: PAGE_SIZES.eventDetail,
    policy: EVENT_DETAIL_PROJECTION_POLICY,
    queryKey: projectionKeys.eventDetail(params.eventId, viewerKey),
    staleTime: STALE_TIMES.eventDetail,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.eventDetail,
  };
}

export function getAlbumEventQueryDef(params: { eventId: string; viewer: ViewerContext }) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    entity: "album-event" as const,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchAlbumEvent(
        params.eventId,
        {
          cursor,
          deltaToken,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.albumEvent, INITIAL_PAGE_SIZES.albumEvent)
              : (limit ?? PAGE_SIZES.albumEvent),
          since,
        },
        params.viewer.id,
      ),
    pageSize: PAGE_SIZES.albumEvent,
    policy: EVENT_DETAIL_PROJECTION_POLICY,
    queryKey: projectionKeys.albumEvent(params.eventId, viewerKey),
    staleTime: STALE_TIMES.albumEvent,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.albumEvent,
  };
}

export {
  getAlbumEventQueryDef as getAlbumEventProjectionQueryDef,
  getEventDetailQueryDef as getEventDetailProjectionQueryDef,
};
