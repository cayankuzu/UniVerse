import type { QueryClient } from "@tanstack/react-query";

import type { AlbumPhotoWithMeta, EventWithMeta } from "../../contracts/content";
import type { ProjectionHomeFeedItem } from "../projections.types";
import type { ProjectionPrefetchSource } from "./prefetchRegistry";
import {
  collectNextStepTargetBatch,
  DEFAULT_INTENT_TARGETS,
  type NextStepTargetCandidate,
} from "./nextStepPrefetch.collector";
export { settleNextStepTasks } from "./nextStepPrefetch.collector";

export function collectHomeNextStepTargets(params: {
  eventPrefetchMode?: "album" | "detail";
  items: ProjectionHomeFeedItem[];
  maxImageItems: number;
  maxTargets?: number;
  prefetchedTargets: Set<string>;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  return collectNextStepTargetBatch({
    candidates: params.items.slice(0, params.maxImageItems).map((item) =>
      item.kind === "event"
        ? createTargetCandidate({
            clubUsername: item.event.clubUsername,
            eventId: item.event.id,
            imageItem: item.event,
          })
        : createTargetCandidate({
            clubUsername: item.album.clubUsername,
            eventId: item.album.eventId,
            imageItem: item.album,
            ownerUsername: item.album.username,
          }),
    ),
    eventPrefetchMode: params.eventPrefetchMode,
    maxTargets: params.maxTargets,
    prefetchedTargets: params.prefetchedTargets,
    prioritizeProfiles: true,
    queryClient: params.queryClient,
    source: params.source,
    viewerId: params.viewerId,
    viewerKey: params.viewerKey,
    viewerUsername: params.viewerUsername,
  });
}

export function collectProfileNextStepTargets(params: {
  albums: AlbumPhotoWithMeta[];
  eventPrefetchMode?: "album" | "detail";
  events: EventWithMeta[];
  maxTargets?: number;
  prefetchedTargets: Set<string>;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const maxTargets = Math.max(0, params.maxTargets ?? DEFAULT_INTENT_TARGETS);
  return collectNextStepTargetBatch({
    candidates: [
      ...params.events.slice(0, maxTargets).map((item) =>
        createTargetCandidate({
          clubUsername: item.clubUsername,
          eventId: item.id,
          imageItem: item,
        }),
      ),
      ...params.albums.slice(0, maxTargets).map((item) =>
        createTargetCandidate({
          clubUsername: item.clubUsername,
          eventId: item.eventId,
          imageItem: item,
          ownerUsername: item.username,
        }),
      ),
    ],
    eventPrefetchMode: params.eventPrefetchMode,
    maxTargets,
    prefetchedTargets: params.prefetchedTargets,
    prioritizeProfiles: true,
    queryClient: params.queryClient,
    source: params.source,
    viewerId: params.viewerId,
    viewerKey: params.viewerKey,
    viewerUsername: params.viewerUsername,
  });
}

function createTargetCandidate(params: {
  clubUsername?: string;
  eventId?: string;
  imageItem: unknown;
  ownerUsername?: string;
}): NextStepTargetCandidate {
  return {
    clubUsername: normalizeTargetUsername(params.clubUsername),
    eventId: String(params.eventId || "").trim(),
    imageItem: params.imageItem,
    ownerUsername: normalizeTargetUsername(params.ownerUsername),
  };
}

function normalizeTargetUsername(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
