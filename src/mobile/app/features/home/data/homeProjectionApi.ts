import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { AlbumAPI, EventAPI } from "../../../data/content";
import { resolveEventAttendeesCount } from "../../../data/content/events/events.attendeeCount";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { fetchEventsFromRpc } from "../../../data/content/events/events.models";
import { mergeAlbumCollections } from "../../../data/normalizers/albums";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import {
  buildHomeProjectionItems,
  filterLegacyHomeItems,
  mapEnvelopeItems,
  nowEnvelope,
  toHomeProjectionItem,
  tryProjectionRpc,
} from "../../../data/projections/projections.api.helpers";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedAlbums,
  filterBlockedEvents,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../../data/social/blockedVisibility";
import { filterFallbackHomeAlbums } from "./homeProjectionFallback.helpers";
import { mergeHomeFeedItemsById, mergeProjectionItemsById } from "./homeProjectionFallback";
import { normalizeProjectionValue } from "../../../data/projections/projections.common";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "../../../data/projections/projections.request";
import {
  getAlbumProjectionHydrationId,
  hydrateHomeProjectionEnvelopeAlbums,
} from "../../../data/projections/projectionAlbumSurfaceHydration";
import type {
  HomeProjectionParams,
  ProjectionHomeFeedItem,
} from "../../../data/projections/projections.types";
import { buildOwnClubShadowItems } from "./homeProjectionProfileSurface";
import { prepareHomeFeedItems } from "./homeFeedAdapters";

function shouldUseIncrementalProjectionFallback(context: ProjectionRequestContext) {
  return Boolean(
    String(context.cursor || "").trim() ||
    String(context.deltaToken || "").trim() ||
    String(context.since || "").trim(),
  );
}

function prepareHomeEnvelope(
  envelope: ProjectionEnvelope<ProjectionHomeFeedItem>,
  params: Pick<
    HomeProjectionParams,
    | "blockedUsernames"
    | "entityFilter"
    | "sortOption"
    | "sourceFilter"
    | "typeFilter"
    | "viewerUsername"
  >,
) {
  const filteredEnvelope = {
    ...envelope,
    items: filterLegacyHomeItems(envelope.items || [], params as HomeProjectionParams),
    updatedItems: filterLegacyHomeItems(
      envelope.updatedItems || [],
      params as HomeProjectionParams,
    ),
  };
  return {
    ...filteredEnvelope,
    items: prepareHomeFeedItems(filteredEnvelope.items || [], params.sortOption || "newest"),
    updatedItems: prepareHomeFeedItems(
      filteredEnvelope.updatedItems || [],
      params.sortOption || "newest",
    ),
  };
}

function normalizeEntityId(value: unknown) {
  return String(value || "").trim();
}

async function reconcileViewerHomeEvents(
  events: EventWithMeta[],
  viewerId?: string,
): Promise<EventWithMeta[]> {
  const normalizedViewerId = normalizeEntityId(viewerId);
  if (!normalizedViewerId || events.length === 0) return events;

  const candidateEventIds = Array.from(
    new Set(
      events
        .filter((item) => item?.id && (!item.joined || Number(item.attendees || 0) <= 0))
        .map((item) => normalizeEntityId(item.id))
        .filter(Boolean),
    ),
  );
  if (candidateEventIds.length === 0) return events;
  const candidateEventIdSet = new Set(candidateEventIds);

  const [joinedRes, metricsRes] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", normalizedViewerId)
      .in("event_id", candidateEventIds),
    supabase
      .from("event_metrics")
      .select("event_id,attendees_count")
      .in("event_id", candidateEventIds),
  ]);

  const joinedEventIds = new Set(
    ((joinedRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => normalizeEntityId(row.event_id))
      .filter(Boolean),
  );
  const metricsByEventId = new Map(
    ((metricsRes.data as Array<{ attendees_count?: number; event_id?: string }>) || []).map(
      (row) => [normalizeEntityId(row.event_id), Number(row.attendees_count || 0)],
    ),
  );

  let changed = false;
  const nextEvents = events.map((item) => {
    const eventId = normalizeEntityId(item.id);
    if (!candidateEventIdSet.has(eventId)) return item;

    const nextJoined = Boolean(item.joined || joinedEventIds.has(eventId));
    const nextAttendees = resolveEventAttendeesCount(
      metricsByEventId.has(eventId) ? metricsByEventId.get(eventId) : item.attendees,
      nextJoined,
    );
    if (nextJoined === Boolean(item.joined) && nextAttendees === Number(item.attendees || 0)) {
      return item;
    }

    changed = true;
    return {
      ...item,
      attendees: nextAttendees,
      joined: nextJoined,
    };
  });

  return changed ? nextEvents : events;
}

async function reconcileViewerHomeEnvelope(
  envelope: ProjectionEnvelope<ProjectionHomeFeedItem>,
  viewerId?: string,
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  const eventRows = [...(envelope.items || []), ...(envelope.updatedItems || [])]
    .filter((item): item is ProjectionHomeFeedItem & { kind: "event" } => item.kind === "event")
    .map((item) => item.event);
  const reconciledEvents = await reconcileViewerHomeEvents(eventRows, viewerId);
  if (reconciledEvents.length === 0) return envelope;

  const reconciledById = new Map(
    reconciledEvents.map((item) => [normalizeEntityId(item.id), item]),
  );
  const patchItems = (items: ProjectionHomeFeedItem[]) =>
    items.map((item) => {
      if (item.kind !== "event") return item;
      const nextEvent = reconciledById.get(normalizeEntityId(item.event.id));
      if (!nextEvent) return item;
      return {
        ...item,
        event: nextEvent,
      };
    });

  return {
    ...envelope,
    items: patchItems(envelope.items || []),
    updatedItems: patchItems(envelope.updatedItems || []),
  };
}

async function buildViewerOwnedAlbumShadowItems(
  params: HomeProjectionParams,
  blockedVisibility: ReturnType<typeof createEmptyBlockedVisibilitySnapshot>,
) {
  const normalizedViewer = normalizeProjectionValue(params.viewerUsername || "");
  if (
    !normalizedViewer ||
    params.viewerAccountType === "club" ||
    params.typeFilter === "events" ||
    !params.viewerId ||
    (blockedVisibility.blockedIds.size === 0 && blockedVisibility.blockedUsernames.size === 0)
  ) {
    return [] as ProjectionHomeFeedItem[];
  }

  const ownProfileAlbums = await loadViewerOwnedAlbumsShadow(normalizedViewer);
  const visibleOwnProfileAlbums = filterBlockedAlbums(ownProfileAlbums, blockedVisibility, {
    preserveViewerOwned: true,
    viewerId: params.viewerId,
    viewerUsername: normalizedViewer,
  });
  if (visibleOwnProfileAlbums.length === 0) {
    return [] as ProjectionHomeFeedItem[];
  }

  return prepareHomeFeedItems(
    filterLegacyHomeItems(
      buildHomeProjectionItems({
        albums: visibleOwnProfileAlbums,
        events: [],
        viewerUsername: normalizedViewer,
      }),
      params,
    ),
    params.sortOption || "newest",
  );
}

async function loadViewerOwnedAlbumsShadow(viewerUsername: string) {
  return AlbumAPI.getPhotos(viewerUsername).catch((error) => {
    debugWarn("HOME/PROJECTION", "viewer-owned-album-shadow-load-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "viewer-owned-album-shadow-load-failed",
      ),
      viewerUsername,
    });
    return [] as AlbumPhotoWithMeta[];
  });
}

async function loadHomeBlockedVisibility(viewerId?: string) {
  return loadViewerBlockedVisibilityOrEmpty(viewerId, {
    scope: "HOME/PROJECTION",
    warningKey: "home-blocked-visibility-load-failed",
  });
}

export async function getHomeFeed(
  params: HomeProjectionParams,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  const isIncrementalRequest = shouldUseIncrementalProjectionFallback(context);
  const buildPrimaryFallbackEnvelope = async (seedEvents?: EventWithMeta[]) => {
    const normalizedViewer = normalizeProjectionValue(params.viewerUsername || "");
    const baseEventsPromise =
      seedEvents && seedEvents.length > 0
        ? Promise.resolve(seedEvents)
        : (async () => {
            const directRpcEvents = params.viewerId
              ? await fetchEventsFromRpc("list_home_feed_events_for_viewer", {
                  target_viewer_id: params.viewerId,
                })
              : null;
            if (Array.isArray(directRpcEvents) && directRpcEvents.length > 0) {
              return directRpcEvents;
            }
            return EventAPI.getHomeFeed();
          })();
    const ownClubEventsPromise =
      params.viewerAccountType === "club" && normalizedViewer
        ? EventAPI.getByClub(normalizedViewer)
        : Promise.resolve([] as EventWithMeta[]);
    const blockedVisibilityPromise = loadHomeBlockedVisibility(params.viewerId);
    const ownProfileAlbumsPromise =
      normalizedViewer && params.viewerAccountType !== "club" && params.typeFilter !== "events"
        ? loadViewerOwnedAlbumsShadow(normalizedViewer)
        : Promise.resolve([] as AlbumPhotoWithMeta[]);
    const [baseEvents, ownClubEvents, blockedVisibility] = await Promise.all([
      baseEventsPromise,
      ownClubEventsPromise,
      blockedVisibilityPromise,
    ]);
    const ownProfileAlbums = await ownProfileAlbumsPromise;
    const mergedEvents = await reconcileViewerHomeEvents(
      filterBlockedEvents(mergeProjectionItemsById(baseEvents, ownClubEvents), blockedVisibility),
      params.viewerId,
    );
    const eventIds = mergedEvents.map((item) => item.id);
    const eventAlbums = eventIds.length > 0 ? await AlbumAPI.getVisibleByEventIds(eventIds) : [];
    const visibleAlbums = filterBlockedAlbums(
      mergeAlbumCollections(eventAlbums, ownProfileAlbums),
      blockedVisibility,
      {
        preserveViewerOwned: true,
        viewerId: params.viewerId,
        viewerUsername: params.viewerUsername,
      },
    );
    const filteredAlbums = filterFallbackHomeAlbums(
      visibleAlbums,
      mergedEvents,
      params.viewerUsername || "",
    );
    return prepareHomeEnvelope(
      nowEnvelope(
        buildHomeProjectionItems({
          albums: filteredAlbums,
          events: mergedEvents,
          viewerUsername: params.viewerUsername,
        }),
      ),
      params,
    );
  };

  const rpcEnvelope = await tryProjectionRpc<unknown>("home_feed_projection", {
    cursor: context.cursor || null,
    ...resolveProjectionDeltaParams(context),
    entity_filter: params.entityFilter || "all",
    limit_count: clampProjectionLimit(context.limit, 33),
    sort_mode: params.sortOption || "newest",
    source_filter: params.sourceFilter || "all",
    type_filter: params.typeFilter || "all",
    viewer_id: params.viewerId || null,
  });
  if (rpcEnvelope) {
    const blockedVisibility = await loadHomeBlockedVisibility(params.viewerId);
    const idsNeedingHydration = new Set<string>();
    const mappedRpcEnvelope = mapEnvelopeItems(rpcEnvelope, (row) => {
      const normalizedItem = toHomeProjectionItem(row);
      if (!normalizedItem || normalizedItem.kind !== "album") {
        return normalizedItem;
      }
      const rowItem = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
      const hydrationId = getAlbumProjectionHydrationId(rowItem?.album, normalizedItem.album);
      if (hydrationId) {
        idsNeedingHydration.add(hydrationId);
      }
      return normalizedItem;
    });
    let mappedEnvelope = prepareHomeEnvelope(
      await reconcileViewerHomeEnvelope(
        await hydrateHomeProjectionEnvelopeAlbums(mappedRpcEnvelope, idsNeedingHydration),
        params.viewerId,
      ),
      params,
    );
    const shouldRecoverEmptyInitialEnvelope =
      !isIncrementalRequest &&
      mappedEnvelope.items.length === 0 &&
      (mappedEnvelope.updatedItems?.length || 0) === 0 &&
      (mappedEnvelope.deletedIds?.length || 0) === 0;

    if (shouldRecoverEmptyInitialEnvelope) {
      const fallbackEnvelope = await buildPrimaryFallbackEnvelope();
      if (fallbackEnvelope.items.length > 0) {
        mappedEnvelope = fallbackEnvelope;
      }
    }

    const ownViewerAlbumShadowItems = await buildViewerOwnedAlbumShadowItems(
      params,
      blockedVisibility,
    );
    if (ownViewerAlbumShadowItems.length > 0) {
      mappedEnvelope = prepareHomeEnvelope(
        {
          ...mappedEnvelope,
          items: mergeHomeFeedItemsById(ownViewerAlbumShadowItems, mappedEnvelope.items || []),
        },
        params,
      );
    }

    const ownShadowItems = await buildOwnClubShadowItems(params);
    if (ownShadowItems.length === 0) {
      return mappedEnvelope;
    }

    return prepareHomeEnvelope(
      {
        ...mappedEnvelope,
        items: mergeHomeFeedItemsById(ownShadowItems, mappedEnvelope.items || []),
      },
      params,
    );
  }

  if (isIncrementalRequest) {
    return nowEnvelope([]);
  }

  return buildPrimaryFallbackEnvelope();
}
