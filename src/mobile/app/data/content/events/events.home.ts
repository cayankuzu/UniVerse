import { supabase } from "../../../platform/supabase";
import { debugWarn } from "../../../platform/logging/logger";
import { getFollowingProfiles } from "../../social/profileFollowing";
import {
  mergeEventCollections,
  mergeSupplementalRestrictedEvents,
  type EventWithMeta,
} from "./events.models";

type ViewerUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null;

function normalizeUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveViewerUsername(
  profileRow: { username?: string | null } | null | undefined,
  user: ViewerUser,
) {
  const metadata = (user?.user_metadata || {}) as Record<string, unknown>;
  return normalizeUsername(
    profileRow?.username ||
      metadata.username ||
      metadata.userName ||
      metadata.user_name ||
      (user?.email ? String(user.email).split("@")[0] : ""),
  );
}

function sortEventsByCreatedAt(events: EventWithMeta[]) {
  return [...events].sort(
    (left, right) =>
      new Date(right.createdAt || right.date || "").getTime() -
      new Date(left.createdAt || left.date || "").getTime(),
  );
}

export async function buildMergedHomeVisibleFeed(
  loadFeed: (filter: string) => Promise<EventWithMeta[]>,
) {
  const [allFeed, followingFeed] = await Promise.all([loadFeed("all"), loadFeed("following")]);
  const supplementalFeed = mergeEventCollections(followingFeed);
  const mergedFeed = mergeEventCollections(
    allFeed,
    mergeSupplementalRestrictedEvents(allFeed, supplementalFeed),
  );

  return {
    allFeed,
    followingFeed,
    mergedFeed,
  };
}

export async function buildHomeFeedFallback(
  loadVisibleFeed: () => Promise<EventWithMeta[]>,
): Promise<EventWithMeta[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = String(user?.id || "").trim();
  if (!viewerId) return [];

  const [profileRes, followsRes, visibleFeed] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,account_type")
      .eq("user_id", viewerId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .eq("status", "accepted")
      .is("deleted_at", null),
    loadVisibleFeed(),
  ]);
  const viewerUsername = resolveViewerUsername(profileRes.data, user);
  const fallbackFollowing = await (viewerUsername
    ? getFollowingProfiles(viewerUsername).catch((error) => {
        debugWarn("CONTENT/EVENTS", "home-fallback-following-load-failed", {
          message: String(
            (error as { message?: string } | null)?.message ||
              "home-fallback-following-load-failed",
          ),
          viewerUsername,
        });
        return [];
      })
    : Promise.resolve([]));

  const followingIds = Array.from(
    new Set(
      ((followsRes.data as Array<{ following_id?: string }>) || [])
        .map((row) => String(row.following_id || "").trim())
        .filter(Boolean),
    ),
  );
  const followingProfilesRes = followingIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,username,account_type")
        .in("user_id", followingIds)
        .is("deleted_at", null)
    : {
        data: [] as Array<{ user_id: string; username: string; account_type: "club" | "student" }>,
        error: null,
      };

  const followingClubIds = new Set<string>();
  const followingStudentIds: string[] = [];
  const followingStudentUsernames = new Map<string, string>();
  const followingClubUsernames = new Set<string>();

  (followingProfilesRes.data || []).forEach((profile) => {
    const id = String(profile.user_id || "").trim();
    const username = normalizeUsername(profile.username);
    if (!id || !username) return;
    if (profile.account_type === "club") {
      followingClubIds.add(id);
      followingClubUsernames.add(username);
      return;
    }
    followingStudentIds.push(id);
    followingStudentUsernames.set(id, username);
  });

  fallbackFollowing.forEach((item) => {
    const username = normalizeUsername(item.username);
    if (!username) return;
    if (item.accountType === "club") {
      followingClubUsernames.add(username);
      return;
    }
    followingStudentUsernames.set(username, username);
  });

  const followedStudentAttendeesRes = followingStudentIds.length
    ? await supabase
        .from("event_attendees")
        .select("event_id,user_id")
        .in("user_id", followingStudentIds)
    : { data: [] as Array<{ event_id?: string; user_id?: string }>, error: null };
  const visibleEventMap = new Map(
    visibleFeed.map((event) => [String(event.id || "").trim(), event]),
  );
  const followedStudentEventActors = new Map<string, string>();

  (
    (followedStudentAttendeesRes.data as Array<{ event_id?: string; user_id?: string }>) || []
  ).forEach((row) => {
    const eventId = String(row.event_id || "").trim();
    const actorId = String(row.user_id || "").trim();
    if (!eventId || !actorId || followedStudentEventActors.has(eventId)) return;
    const actorUsername = followingStudentUsernames.get(actorId);
    if (!actorUsername || !visibleEventMap.has(eventId)) return;
    followedStudentEventActors.set(eventId, actorUsername);
  });

  const prioritized: Array<{ priority: number; event: EventWithMeta }> = [];
  visibleFeed.forEach((event) => {
    const clubUserId = String(event.clubUserId || "").trim();
    const clubUsername = normalizeUsername(event.clubUsername);
    if (followingClubIds.has(clubUserId)) {
      prioritized.push({
        priority: 2,
        event: {
          ...event,
          feedActorType: "club",
          feedActorUsername: event.clubUsername,
          feedSource: "following_club",
        },
      });
      return;
    }
    if (clubUsername && followingClubUsernames.has(clubUsername)) {
      prioritized.push({
        priority: 2,
        event: {
          ...event,
          feedActorType: "club",
          feedActorUsername: event.clubUsername,
          feedSource: "following_club",
        },
      });
      return;
    }

    const actorUsername = followedStudentEventActors.get(String(event.id || "").trim());
    if (!actorUsername) return;
    prioritized.push({
      priority: 3,
      event: {
        ...event,
        feedActorType: "student",
        feedActorUsername: actorUsername,
        feedSource: "following_student",
      },
    });
  });

  const deduped = new Map<string, { priority: number; event: EventWithMeta }>();
  prioritized
    .sort((left, right) => left.priority - right.priority)
    .forEach((item) => {
      const key = String(item.event.id || "").trim();
      if (!key || deduped.has(key)) return;
      deduped.set(key, item);
    });

  return sortEventsByCreatedAt(Array.from(deduped.values()).map((item) => item.event));
}
