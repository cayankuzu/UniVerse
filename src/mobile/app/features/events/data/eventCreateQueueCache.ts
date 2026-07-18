import type { QueryClient } from "@tanstack/react-query";
import type { EventWithMeta } from "../../../data/contracts/content";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  prependProjectionItem,
  removeProjectionItemIds,
  replaceProjectionItemId,
} from "../../../data/projections/projections";
import { DEFAULT_EVENT_SEARCH_SCOPE } from "./eventCreateQueue.types";

function homeEventItem(event: EventWithMeta) {
  return {
    actor: "club" as const,
    event,
    id: `event:${event.id}`,
    kind: "event" as const,
    sortDate: event.createdAt || new Date().toISOString(),
    source: "own" as const,
  };
}

export function patchQueuedEventCaches(params: {
  event: EventWithMeta;
  previousId?: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  const { event, previousId, queryClient, viewerKey } = params;
  const username = String(event.clubUsername || "").trim();
  const previousHomeId = previousId ? `event:${previousId}` : "";

  if (previousId) {
    replaceProjectionItemId({
      entity: "home-feed",
      nextItem: homeEventItem(event),
      previousId: previousHomeId,
      queryClient,
      screenKey: projectionKeys.home(viewerKey, "all:all:all:newest"),
    });
    replaceProjectionItemId({
      entity: "profile-events",
      nextItem: event,
      previousId,
      queryClient,
      screenKey: projectionKeys.profileContent(username, "events", viewerKey),
    });
    replaceProjectionItemId({
      entity: "search-events",
      nextItem: event,
      previousId,
      queryClient,
      screenKey: projectionKeys.search("events", viewerKey, DEFAULT_EVENT_SEARCH_SCOPE),
    });
    return;
  }

  prependProjectionItem({
    entity: "home-feed",
    item: homeEventItem(event),
    queryClient,
    screenKey: projectionKeys.home(viewerKey, "all:all:all:newest"),
  });
  prependProjectionItem({
    entity: "profile-events",
    item: event,
    queryClient,
    screenKey: projectionKeys.profileContent(username, "events", viewerKey),
  });
  prependProjectionItem({
    entity: "search-events",
    item: event,
    queryClient,
    screenKey: projectionKeys.search("events", viewerKey, DEFAULT_EVENT_SEARCH_SCOPE),
  });
}

export function removeQueuedEventCaches(params: {
  eventId: string;
  queryClient: QueryClient;
  username: string;
  viewerKey: string;
}) {
  const { eventId, queryClient, username, viewerKey } = params;
  removeProjectionItemIds({
    entity: "home-feed",
    ids: [`event:${eventId}`],
    queryClient,
    screenKey: projectionKeys.home(viewerKey, "all:all:all:newest"),
  });
  removeProjectionItemIds({
    entity: "profile-events",
    ids: [eventId],
    queryClient,
    screenKey: projectionKeys.profileContent(username, "events", viewerKey),
  });
  removeProjectionItemIds({
    entity: "search-events",
    ids: [eventId],
    queryClient,
    screenKey: projectionKeys.search("events", viewerKey, DEFAULT_EVENT_SEARCH_SCOPE),
  });
}
