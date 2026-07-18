import type { AttendResponse, LikeResponse } from "../../contracts/api";
import { hydrateEventsWithServerAlbumCounts } from "./events.albumCounts";
import { resolveEventAttendeesCount } from "./events.attendeeCount";
import { ensureEventCommentCounts } from "./events.feed";
import type { EventWithMeta } from "./events.models";

function getEventSortTime(event: EventWithMeta) {
  const primary = new Date(String(event.createdAt || "")).getTime();
  if (Number.isFinite(primary) && primary > 0) return primary;
  const secondary = new Date(String(event.startDate || event.date || "")).getTime();
  return Number.isFinite(secondary) ? secondary : 0;
}

export function mergeUniqueEvents(
  ...collections: Array<EventWithMeta[] | null | undefined>
): EventWithMeta[] {
  const byId = new Map<string, EventWithMeta>();
  collections.forEach((collection) => {
    (collection || []).forEach((event) => {
      const id = String(event?.id || "").trim();
      if (!id) return;
      const existing = byId.get(id);
      byId.set(id, existing ? { ...existing, ...event } : event);
    });
  });
  return Array.from(byId.values()).sort((a, b) => getEventSortTime(b) - getEventSortTime(a));
}

export async function finalizeEventRows(events: EventWithMeta[]) {
  return hydrateEventsWithServerAlbumCounts(await ensureEventCommentCounts(events));
}

export function extractEventLikeResponse(data: unknown): LikeResponse | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return {
    count: Number((row as { likes_count?: number }).likes_count || 0),
    liked: Boolean((row as { liked?: boolean }).liked),
  };
}

export function extractEventAttendResponse(data: unknown): AttendResponse | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return {
    joined: Boolean((row as { joined?: boolean }).joined),
    count: resolveEventAttendeesCount(
      (row as { attendees_count?: number }).attendees_count,
      (row as { joined?: boolean }).joined,
    ),
  };
}

export function toEventMutationError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && String(error.message || "").trim()) return error;
  const message = String((error as { message?: string })?.message || error || "").trim();
  return new Error(message || fallbackMessage);
}
