import { RUNTIME_FLAGS } from "../../platform/config/runtime";
import { recordSecurityTelemetryEvent } from "../../platform/security/securityTelemetry";
import type { ProjectionEnvelope } from "../query/contracts";
import { AlbumAPI } from "../content/albums.api";
import { EventAPI } from "../content/events.api";
import {
  hasAlbumProjectionSurfaceFlags,
  normalizeAlbumProjectionItem,
} from "../normalizers/albums";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedAlbums,
  isBlockedEventOwner,
  loadViewerBlockedVisibility,
} from "../social/blockedVisibility";
import { hydrateAlbumProjectionEnvelope } from "./projectionAlbumSurfaceHydration";
import {
  mapEnvelopeItems,
  nowEnvelope,
  toEventDetailProjection,
  tryProjectionRpc,
} from "./projections.api.helpers";
import {
  clampProjectionLimit,
  isProjectionUuid,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "./projections.request";
import type { AlbumEventProjectionItem, EventDetailProjection } from "./projections.types";

function filterBlockedEventDetailEnvelope(
  envelope: ProjectionEnvelope<EventDetailProjection>,
  blockedVisibility: ReturnType<typeof createEmptyBlockedVisibilitySnapshot>,
) {
  return {
    ...envelope,
    items: (envelope.items || []).filter(
      (item) => item?.event && !isBlockedEventOwner(blockedVisibility, item.event),
    ),
    updatedItems: (envelope.updatedItems || []).filter(
      (item) => item?.event && !isBlockedEventOwner(blockedVisibility, item.event),
    ),
  };
}

function hasIncrementalProjectionRequest(context: ProjectionRequestContext) {
  return Boolean(
    String(context.cursor || "").trim() ||
    String(context.deltaToken || "").trim() ||
    String(context.since || "").trim(),
  );
}

export async function getEventDetailProjection(params: {
  context?: ProjectionRequestContext;
  eventId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  if (!isProjectionUuid(params.eventId)) return nowEnvelope<EventDetailProjection>([]);
  const blockedVisibility = params.viewerId
    ? await loadViewerBlockedVisibility(params.viewerId)
    : createEmptyBlockedVisibilitySnapshot();

  try {
    const rpcArgs = {
      ...resolveProjectionDeltaParams(context),
      target_event_id: params.eventId,
      viewer_id: params.viewerId || null,
    };
    const rpcEnvelope = RUNTIME_FLAGS.useProjectionEventDetail
      ? context.signal
        ? await tryProjectionRpc<unknown>("event_detail_projection", rpcArgs, context.signal)
        : await tryProjectionRpc<unknown>("event_detail_projection", rpcArgs)
      : null;

    if (rpcEnvelope) {
      const mappedEnvelope = filterBlockedEventDetailEnvelope(
        mapEnvelopeItems(rpcEnvelope, toEventDetailProjection),
        blockedVisibility,
      );
      if (mappedEnvelope.items.length > 0 || (mappedEnvelope.updatedItems || []).length > 0) {
        recordSecurityTelemetryEvent({
          action: "event.access",
          meta: { source: "projection_rpc" },
          resourceId: params.eventId,
          resourceType: "event",
          result: "success",
        });
        return mappedEnvelope;
      }
    }

    if (hasIncrementalProjectionRequest(context)) {
      return nowEnvelope<EventDetailProjection>([]);
    }

    const event = await EventAPI.getById(params.eventId);
    if (isBlockedEventOwner(blockedVisibility, event)) {
      return nowEnvelope<EventDetailProjection>([]);
    }
    recordSecurityTelemetryEvent({
      action: "event.access",
      meta: { source: "fallback_read" },
      resourceId: params.eventId,
      resourceType: "event",
      result: "success",
    });
    return nowEnvelope<EventDetailProjection>([
      {
        albumCount: Number(event.albumCount || 0),
        event,
        id: event.id,
      },
    ]);
  } catch (error) {
    recordSecurityTelemetryEvent({
      action: "event.access",
      meta: {
        message: String((error as { message?: string } | null)?.message || "event-access-failed"),
      },
      resourceId: params.eventId,
      resourceType: "event",
      result: "fail",
    });
    throw error;
  }
}

export async function getAlbumEventProjection(params: {
  context?: ProjectionRequestContext;
  eventId: string;
  viewerId?: string;
}) {
  const context = params.context || {};
  if (!isProjectionUuid(params.eventId)) return nowEnvelope<AlbumEventProjectionItem>([]);
  const blockedVisibility = params.viewerId
    ? await loadViewerBlockedVisibility(params.viewerId)
    : createEmptyBlockedVisibilitySnapshot();

  try {
    const rpcArgs = {
      cursor: context.cursor || null,
      ...resolveProjectionDeltaParams(context),
      limit_count: clampProjectionLimit(context.limit, 33),
      target_event_id: params.eventId,
      viewer_id: params.viewerId || null,
    };
    const rpcEnvelope = RUNTIME_FLAGS.useProjectionAlbum
      ? context.signal
        ? await tryProjectionRpc<unknown>("album_event_projection", rpcArgs, context.signal)
        : await tryProjectionRpc<unknown>("album_event_projection", rpcArgs)
      : null;

    if (rpcEnvelope) {
      const idsNeedingHydration = new Set<string>();
      const mappedEnvelope = await hydrateAlbumProjectionEnvelope(
        mapEnvelopeItems(rpcEnvelope, (row) => {
          const item = normalizeAlbumProjectionItem(row);
          if (item && !hasAlbumProjectionSurfaceFlags(row)) {
            idsNeedingHydration.add(item.id);
          }
          return item;
        }),
        idsNeedingHydration,
      );
      const filteredEnvelope = {
        ...mappedEnvelope,
        items: filterBlockedAlbums(mappedEnvelope.items || [], blockedVisibility, {
          preserveViewerOwned: true,
          viewerId: params.viewerId,
        }),
        updatedItems: filterBlockedAlbums(mappedEnvelope.updatedItems || [], blockedVisibility, {
          preserveViewerOwned: true,
          viewerId: params.viewerId,
        }),
      };
      recordSecurityTelemetryEvent({
        action: "album.access",
        meta: { source: "projection_rpc" },
        resourceId: params.eventId,
        resourceType: "album",
        result: "success",
      });
      return filteredEnvelope;
    }

    recordSecurityTelemetryEvent({
      action: "album.access",
      meta: { source: "fallback_read" },
      resourceId: params.eventId,
      resourceType: "album",
      result: "success",
    });
    return nowEnvelope(
      filterBlockedAlbums(await AlbumAPI.getEventPhotos(params.eventId), blockedVisibility, {
        preserveViewerOwned: true,
        viewerId: params.viewerId,
      }),
    );
  } catch (error) {
    recordSecurityTelemetryEvent({
      action: "album.access",
      meta: {
        message: String((error as { message?: string } | null)?.message || "album-access-failed"),
      },
      resourceId: params.eventId,
      resourceType: "album",
      result: "fail",
    });
    throw error;
  }
}
