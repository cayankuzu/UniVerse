import * as kv from "../kv_store.ts";
import type {
  EdgeRouteApp,
  EnrichedKvEventRecord,
  KvBlockedRecord,
  KvEventRecord,
  KvFollowRecord,
  KvProfileRecord,
  ServerRouteDeps,
} from "../types.ts";
import { createBlockedStateReader } from "../services/blockedState.ts";
import { CompatRouteValidationError } from "./compatRouteValidation.ts";
import { resolveCompatProfilePrivacy } from "./compatProfilePrivacy.ts";

export type EventVisibilityRecord = EnrichedKvEventRecord & {
  clubIsPrivate: boolean;
  effectiveVisibility: string;
  visibility: string;
};

export type EventDeleteContext = {
  clubUserId: string;
  clubUsername: string;
  kvEvent: KvEventRecord | null;
};

export function toRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof CompatRouteValidationError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  return {
    message: fallbackMessage,
    status: 500,
  };
}

export function normalizeEventCreateErrorMessage(error: unknown) {
  const rawMessage = String((error as { message?: string } | null)?.message || error || "").trim();
  const normalized = rawMessage.toLowerCase();
  if (!rawMessage) return "Etkinlik olusturulamadi.";
  if (
    normalized.includes("only club accounts can create events") ||
    normalized.includes("only clubs can create events") ||
    normalized.includes("club profile not found")
  ) {
    return "Etkinlik yalnizca kulup hesaplariyla paylasilabilir.";
  }
  if (normalized.includes("events_desc_len")) {
    return "Etkinlik aciklamasi en az 10 karakter olmali.";
  }
  if (normalized.includes("events_title_len")) {
    return "Etkinlik basligi 3 ile 120 karakter arasinda olmali.";
  }
  if (normalized.includes("events_capacity_positive")) {
    return "Kontenjan 0'dan buyuk olmali.";
  }
  if (normalized.includes("events_time_range")) {
    return "Bitis tarihi ve saati baslangictan once olamaz.";
  }
  return rawMessage;
}

export function toNonEmptyText(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function toIsoDateTime(dateValue: unknown, timeValue: unknown, fallbackTime: string) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || fallbackTime || "00:00").trim();
  if (!date) return new Date().toISOString();
  const candidate = new Date(`${date}T${time}:00`);
  if (Number.isNaN(candidate.getTime())) return new Date().toISOString();
  return candidate.toISOString();
}

export function toTextArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function normalizeAccessText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0131\u0130]/g, "i")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveEventAttendanceScope(accessLabel: unknown) {
  const normalized = normalizeAccessText(accessLabel);
  if (normalized.includes("universite")) return "university_only" as const;
  if (
    normalized.includes("uye") ||
    normalized.includes("takipci") ||
    normalized.includes("member") ||
    normalized.includes("follower")
  ) {
    return "followers_only" as const;
  }
  return "public" as const;
}

export function resolveEventVisibilityFromAccess(accessLabel: unknown) {
  return resolveEventAttendanceScope(accessLabel) === "followers_only" ? "members_only" : "public";
}

export function buildProfileSummary(profile: KvProfileRecord | null) {
  if (!profile) return null;
  return {
    accountType: profile.accountType,
    id: profile.id,
    image: profile.profileImage,
    name: profile.name || profile.clubName,
    username: profile.username,
  };
}

export function createEventRouteContext(
  deps: Pick<ServerRouteDeps, "adminSupabase" | "enrichEvent">,
) {
  const { adminSupabase, enrichEvent } = deps;
  const loadBlockedRows = (userId: string) =>
    kv.get<KvBlockedRecord[]>(`blocked:${userId}`).then((value) => value || []);

  return function createEventRequestContext() {
    const blockedState = createBlockedStateReader({ loadBlockedRows });
    const profileCache = new Map<string, KvProfileRecord | null>();

    const getProfile = async (userId: string) => {
      if (!userId) return null;
      if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
      const profile = await kv.get<KvProfileRecord>(`profile:${userId}`);
      if (!profile) {
        profileCache.set(userId, null);
        return null;
      }
      const normalizedProfile = {
        ...profile,
        isPrivate: resolveCompatProfilePrivacy(profile.accountType, profile.isPrivate),
      } satisfies KvProfileRecord;
      profileCache.set(userId, normalizedProfile);
      return normalizedProfile;
    };

    const getViewerRelations = async (userId: string) => {
      if (!userId) {
        return {
          followingUsernames: new Set<string>(),
        };
      }

      const followingRows = await kv
        .get<KvFollowRecord[]>(`following:${userId}`)
        .then((value) => value || []);

      return {
        followingUsernames: new Set(
          followingRows
            .map((item) =>
              String(item?.username || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      };
    };

    const canDiscoverEventCard = (
      viewerId: string,
      event: KvEventRecord,
      clubProfile: KvProfileRecord | null,
      followingUsernames: Set<string>,
    ) => {
      const clubUsername = String(event.clubUsername || "")
        .trim()
        .toLowerCase();
      if (!clubUsername) return false;

      const isOwnClub = !!viewerId && String(event.clubUserId || "").trim() === viewerId;
      if (isOwnClub) return true;

      const clubIsPrivate = resolveCompatProfilePrivacy(
        clubProfile?.accountType,
        clubProfile?.isPrivate,
      );
      if (!clubIsPrivate) return true;

      return followingUsernames.has(clubUsername);
    };

    const decorateEventVisibility = (
      event: EnrichedKvEventRecord,
      clubProfile: KvProfileRecord | null,
    ) => {
      const clubIsPrivate = resolveCompatProfilePrivacy(
        clubProfile?.accountType,
        clubProfile?.isPrivate,
      );
      return {
        ...event,
        clubIsPrivate,
        visibility: "public",
        effectiveVisibility: "public",
      };
    };

    const filterBlockedEvents = async (viewerId: string, events: KvEventRecord[]) => {
      if (!viewerId || events.length === 0) return events;
      const next: KvEventRecord[] = [];
      for (const event of events) {
        const clubUserId = String(event.clubUserId || "").trim();
        if (!clubUserId) continue;
        if (await blockedState.isBlockedPair(viewerId, clubUserId)) continue;
        next.push(event);
      }
      return next;
    };

    const getDeleteEventContext = async (eventId: string): Promise<EventDeleteContext | null> => {
      const normalizedEventId = String(eventId || "").trim();
      if (!normalizedEventId) return null;

      const [kvEvent, dbEventRes] = await Promise.all([
        kv.get<KvEventRecord>(`event:${normalizedEventId}`),
        adminSupabase.from("events").select("id,club_id").eq("id", normalizedEventId).maybeSingle(),
      ]);

      const clubUserId = String(dbEventRes.data?.club_id || kvEvent?.clubUserId || "").trim();
      const clubUsername = String(kvEvent?.clubUsername || "")
        .trim()
        .toLowerCase();

      if (!clubUserId && !clubUsername && !dbEventRes.data && !kvEvent) return null;

      return {
        clubUserId,
        clubUsername,
        kvEvent,
      };
    };

    const canModerateEvent = (viewerId: string, ownerUserId: string) =>
      Boolean(viewerId) && Boolean(ownerUserId) && String(viewerId) === String(ownerUserId);

    const buildVisibleEvents = async (
      viewerId: string,
      followingUsernames: Set<string>,
      events: KvEventRecord[],
    ): Promise<EventVisibilityRecord[]> => {
      const validEvents = events.filter(Boolean);
      const clubProfiles = await Promise.all(
        validEvents.map((event) => getProfile(String(event.clubUserId || "").trim())),
      );
      const visibleEvents = validEvents.filter((event, index) =>
        canDiscoverEventCard(viewerId, event, clubProfiles[index], followingUsernames),
      );
      const unblockedEvents = await filterBlockedEvents(viewerId, visibleEvents);
      const enriched = await Promise.all(
        unblockedEvents.map(async (event) => {
          const clubProfile = await getProfile(String(event.clubUserId || "").trim());
          const row = await enrichEvent(event, viewerId);
          return decorateEventVisibility(row, clubProfile);
        }),
      );
      return enriched.sort(
        (a, b) =>
          new Date(String(b.createdAt || 0)).getTime() -
          new Date(String(a.createdAt || 0)).getTime(),
      );
    };

    return {
      buildVisibleEvents,
      canModerateEvent,
      filterBlockedEvents,
      getDeleteEventContext,
      getProfile,
      getViewerRelations,
      isBlockedPair: blockedState.isBlockedPair,
    };
  };
}

export type EventRouteContextFactory = ReturnType<typeof createEventRouteContext>;
export type EventRouteContextHelpers = ReturnType<EventRouteContextFactory>;
export type EventRouteApp = EdgeRouteApp;
