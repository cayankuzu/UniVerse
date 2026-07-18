import { getRegisteredProjectionSyncEntries } from "../../data/projections/sync/syncOrchestrator";

const MAX_CONTENT_REALTIME_EVENT_IDS = 6;
const MAX_CONTENT_REALTIME_PHOTO_IDS = 8;

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function trimScopeIds(values: Set<string>, maxItems: number) {
  return Array.from(values).slice(0, maxItems);
}

export function collectContentRealtimeScope() {
  const eventIds = new Set<string>();
  const photoIds = new Set<string>();
  getRegisteredProjectionSyncEntries().forEach(([, projection]) => {
    const queryKey = Array.isArray(projection.queryKey) ? projection.queryKey : [];
    if (queryKey[0] !== "screen") return;
    const domain = normalize(queryKey[1]);
    if (
      domain === "event-detail" ||
      domain === "album-event" ||
      domain === "event-comments" ||
      domain === "event-likers" ||
      domain === "event-attendees"
    ) {
      const eventId = normalize(queryKey[2]);
      if (eventId) eventIds.add(eventId);
      return;
    }
    if (domain === "album-comments") {
      const photoId = normalize(queryKey[2]);
      if (photoId) photoIds.add(photoId);
    }
  });
  return {
    eventIds: trimScopeIds(eventIds, MAX_CONTENT_REALTIME_EVENT_IDS),
    photoIds: trimScopeIds(photoIds, MAX_CONTENT_REALTIME_PHOTO_IDS),
  };
}

export function normalizeRealtimeValue(value: unknown) {
  return normalize(value);
}

export function serializeContentRealtimeScope(scope: { eventIds: string[]; photoIds: string[] }) {
  return JSON.stringify({
    eventIds: [...scope.eventIds].sort(),
    photoIds: [...scope.photoIds].sort(),
  });
}
