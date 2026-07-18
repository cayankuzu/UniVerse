import { supabase } from "../../../platform/supabase";
import { AppDataError } from "../../errors/appDataError";
import { fetchRemoteProfileEvents } from "../../profile/remoteProfileContent";
import { resolveProfileIdByUsername } from "../../profile/profileLookup";
import { fetchEventsFromTable, fetchProfileEventsFromTable } from "./events.feed";
import { buildHomeFeedFallback } from "./events.home";
import { getLocalEventShadowByClubUserId, getLocalEventShadowByClubUsername } from "./events.local";
import { fetchEventsFromRpc, type EventWithMeta } from "./events.models";
import { finalizeEventRows, mergeUniqueEvents } from "./events.shared";
import {
  readTimedReadCacheValue,
  readTimedReadMapCacheValue,
  resetTimedReadCacheEntry,
  type TimedReadCacheEntry,
} from "../readCache";

const PROFILE_EVENT_CACHE_TTL_MS = 900;
const VIEWER_ID_CACHE_TTL_MS = 1_000;

const profileEventCache = new Map<string, TimedReadCacheEntry<EventWithMeta[]>>();

const viewerIdCache: TimedReadCacheEntry<string> = {
  expiresAt: 0,
  promise: null,
  value: "",
};

function cloneEvents(items: EventWithMeta[]) {
  return items.slice();
}

async function readViewerId() {
  return readTimedReadCacheValue({
    entry: viewerIdCache,
    task: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return String(user?.id || "").trim();
    },
    ttlMs: VIEWER_ID_CACHE_TTL_MS,
  });
}

async function withProfileEventCache(cacheKey: string, task: () => Promise<EventWithMeta[]>) {
  return readTimedReadMapCacheValue({
    cache: profileEventCache,
    clone: cloneEvents,
    key: cacheKey,
    task,
    ttlMs: PROFILE_EVENT_CACHE_TTL_MS,
  });
}

export function resetEventReadCachesForTests() {
  profileEventCache.clear();
  resetTimedReadCacheEntry(viewerIdCache);
  viewerIdCache.value = "";
}

export async function getEventFeed(filter: string): Promise<EventWithMeta[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const localShadow =
    filter === "all" && user?.id ? await getLocalEventShadowByClubUserId(user.id) : [];

  const fromRpc = await fetchEventsFromRpc("list_visible_events", { filter_mode: filter });
  if (Array.isArray(fromRpc) && fromRpc.length > 0) {
    return finalizeEventRows(mergeUniqueEvents(localShadow, fromRpc));
  }

  const fromTable = await fetchEventsFromTable(filter);
  const merged = mergeUniqueEvents(localShadow, fromTable || []);
  if (merged.length > 0) return finalizeEventRows(merged);

  return finalizeEventRows(localShadow);
}

export async function getEventHomeFeed(): Promise<EventWithMeta[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const localShadow = user?.id ? await getLocalEventShadowByClubUserId(user.id) : [];

  const fromRpc = await fetchEventsFromRpc("list_home_feed_events_for_viewer", {
    target_viewer_id: user?.id || null,
  });
  const merged = mergeUniqueEvents(localShadow, fromRpc || []);
  if (merged.length > 0) return finalizeEventRows(merged);

  const visibleFeed = await fetchEventsFromTable("all");
  const fallback = await buildHomeFeedFallback(() => Promise.resolve(visibleFeed || []));
  if (fallback.length > 0) return finalizeEventRows(mergeUniqueEvents(localShadow, fallback));

  return [];
}

export async function getEventsByClub(
  username: string,
  targetUserIdHint?: string | null,
): Promise<EventWithMeta[]> {
  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();
  if (!normalizedUsername) return [];

  const viewerId = await readViewerId();
  return withProfileEventCache(`club:${viewerId || "anon"}:${normalizedUsername}`, async () => {
    const targetUserId =
      String(targetUserIdHint || "").trim() ||
      (await resolveProfileIdByUsername(normalizedUsername));
    const allowLocalShadow = Boolean(viewerId && targetUserId && viewerId === targetUserId);
    const localShadow = allowLocalShadow
      ? await getLocalEventShadowByClubUsername(normalizedUsername)
      : [];

    if (targetUserId) {
      const fromProfileScopedRpc = await fetchEventsFromRpc("list_profile_visible_events", {
        target_profile_id: targetUserId,
      });
      if (Array.isArray(fromProfileScopedRpc)) {
        return finalizeEventRows(mergeUniqueEvents(localShadow, fromProfileScopedRpc));
      }
    }

    const fromClubRpc = await fetchEventsFromRpc("list_club_visible_events", {
      target_username: normalizedUsername,
    });
    if (Array.isArray(fromClubRpc) && fromClubRpc.length > 0) {
      return finalizeEventRows(mergeUniqueEvents(localShadow, fromClubRpc));
    }

    const fromTable = await fetchEventsFromTable("all");

    const filteredTable = (fromTable || []).filter(
      (item) =>
        String(item.clubUsername || "")
          .trim()
          .toLowerCase() === normalizedUsername,
    );
    const merged = mergeUniqueEvents(localShadow, filteredTable);
    if (merged.length > 0) return finalizeEventRows(merged);

    return finalizeEventRows(localShadow);
  });
}

export async function getProfileEvents(username: string): Promise<EventWithMeta[]> {
  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();
  if (!normalizedUsername) return [];

  const viewerId = await readViewerId();
  return withProfileEventCache(`profile:${viewerId || "anon"}:${normalizedUsername}`, async () => {
    const targetUserId = await resolveProfileIdByUsername(normalizedUsername);
    if (!targetUserId) {
      return finalizeEventRows(await fetchRemoteProfileEvents(normalizedUsername));
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (profileRow?.account_type === "club") {
      return getEventsByClub(normalizedUsername, targetUserId);
    }

    const fromRpc = await fetchEventsFromRpc("list_profile_visible_events", {
      target_profile_id: targetUserId,
    });
    if (Array.isArray(fromRpc)) return finalizeEventRows(fromRpc);

    const { data: attendeeRows, error: attendeeError } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", targetUserId);

    if (!attendeeError && Array.isArray(attendeeRows)) {
      const attendeeEventIds = attendeeRows
        .map((row) => String(row.event_id || "").trim())
        .filter(Boolean);

      if (attendeeEventIds.length > 0) {
        const fromTable = await fetchProfileEventsFromTable(attendeeEventIds);
        if (fromTable && fromTable.length > 0) return finalizeEventRows(fromTable);
      }
    }

    return [];
  });
}

export async function getEventById(id: string): Promise<EventWithMeta> {
  const fromRpc = await fetchEventsFromRpc("get_visible_event", { target_event_id: id });
  if (fromRpc?.[0]) {
    const hydrated = await finalizeEventRows([fromRpc[0]]);
    return hydrated[0];
  }

  const fromTable = await fetchEventsFromTable("all");
  const tableMatch = (fromTable || []).find((item) => item.id === id);
  if (tableMatch) {
    const hydrated = await finalizeEventRows([tableMatch]);
    return hydrated[0];
  }

  throw new AppDataError({
    code: "not_found",
    message: "Event not found or not visible",
    meta: { eventId: id },
  });
}
