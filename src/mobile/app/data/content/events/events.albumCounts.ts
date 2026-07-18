import { supabase } from "../../../platform/supabase";
import type { EventWithMeta } from "./events.models";

type EventAlbumCountRow = {
  album_count: number | null;
  event_id: string;
};

export type EventAlbumCountMap = Record<string, number>;

export async function getEventAlbumCountMap(eventIds: string[]): Promise<EventAlbumCountMap> {
  const normalizedEventIds = Array.from(
    new Set(eventIds.map((item) => String(item || "").trim()).filter(Boolean)),
  );

  if (normalizedEventIds.length === 0) return {};

  const { data, error } = await supabase.rpc("get_event_album_card_counts", {
    target_event_ids: normalizedEventIds,
  });

  if (error || !Array.isArray(data)) return {};

  return data.reduce<EventAlbumCountMap>((acc, row) => {
    const typed = row as EventAlbumCountRow;
    const eventId = String(typed.event_id || "").trim();
    if (!eventId) return acc;
    acc[eventId] = Math.max(0, Number(typed.album_count || 0));
    return acc;
  }, {});
}

export function applyEventAlbumCountMap(
  events: EventWithMeta[],
  countMap?: EventAlbumCountMap,
): EventWithMeta[] {
  if (!countMap) return events;

  return events.map((event) => {
    const eventId = String(event.id || "").trim();
    const serverCount = countMap[eventId];
    if (typeof serverCount !== "number") return event;
    return {
      ...event,
      albumCount: Math.max(Number(event.albumCount || 0), serverCount),
    };
  });
}

export async function hydrateEventsWithServerAlbumCounts(
  events: EventWithMeta[],
): Promise<EventWithMeta[]> {
  return applyEventAlbumCountMap(
    events,
    await getEventAlbumCountMap(events.map((item) => String(item.id || "").trim())),
  );
}
