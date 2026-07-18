import { supabase } from "../../../platform/supabase";
import { toDisplayName } from "../../profile/profileDisplay";
import { type EventTableRow, type EventWithMeta } from "./events.models";
import { resolveEventAttendeesCount } from "./events.attendeeCount";

export function resolveViewerUsername(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null,
  profileMap: Map<string, { username?: string | null }>,
): string {
  if (!user) return "";
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fromProfile = String(profileMap.get(user.id)?.username || "")
    .trim()
    .toLowerCase();
  if (fromProfile) return fromProfile;

  const candidates = [
    metadata.username,
    metadata.userName,
    metadata.user_name,
    user.email ? String(user.email).split("@")[0] : "",
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  return candidates[0] || "";
}

export async function fetchEventsFromTable(filterMode: string): Promise<EventWithMeta[] | null> {
  const [
    {
      data: { user },
    },
    eventsRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("events")
      .select(
        "id,club_id,title,description,cover_image_path,starts_at,ends_at,location_name,address,event_type,category,categories,fee_label,access_label,capacity,target_audience,level,materials,visibility,created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsRes.error || !Array.isArray(eventsRes.data)) return null;
  if (!eventsRes.data.length) return [];

  const viewerId = String(user?.id || "").trim();
  const eventRows = eventsRes.data as EventTableRow[];
  const eventIds = eventRows.map((row) => row.id).filter(Boolean);
  const clubIds = Array.from(
    new Set(eventRows.map((row) => String(row.club_id || "").trim()).filter(Boolean)),
  );
  const profileIds = Array.from(new Set([...(viewerId ? [viewerId] : []), ...clubIds]));

  const [profilesRes, metricsRes, likesRes, joinedRes, followsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,username,name,club_name,profile_image_path,university,is_private")
      .in("user_id", profileIds)
      .is("deleted_at", null),
    supabase
      .from("event_metrics")
      .select("event_id,likes_count,attendees_count,comments_count")
      .in("event_id", eventIds),
    viewerId
      ? supabase
          .from("event_likes")
          .select("event_id")
          .eq("user_id", viewerId)
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? supabase
          .from("event_attendees")
          .select("event_id")
          .eq("user_id", viewerId)
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewerId)
          .eq("status", "accepted")
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesRes.error || !Array.isArray(profilesRes.data)) return null;

  const profileMap = new Map(
    (profilesRes.data || []).map((profile) => [String(profile.user_id || "").trim(), profile]),
  );
  const metricsMap = new Map(
    (
      (metricsRes.data as Array<{
        event_id?: string;
        likes_count?: number;
        attendees_count?: number;
        comments_count?: number;
      }>) || []
    ).map((metric) => [String(metric.event_id || "").trim(), metric]),
  );
  const likedEventIds = new Set(
    ((likesRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => String(row.event_id || "").trim())
      .filter(Boolean),
  );
  const joinedEventIds = new Set(
    ((joinedRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => String(row.event_id || "").trim())
      .filter(Boolean),
  );
  const followedClubIds = new Set(
    ((followsRes.data as Array<{ following_id?: string }>) || [])
      .map((row) => String(row.following_id || "").trim())
      .filter(Boolean),
  );
  return eventRows.reduce<EventWithMeta[]>((acc, row) => {
    const clubId = String(row.club_id || "").trim();
    const eventId = String(row.id || "").trim();
    const clubProfile = profileMap.get(clubId);
    if (!clubId || !eventId || !clubProfile) return acc;

    const isOwn = !!viewerId && clubId === viewerId;
    const isFollowing = followedClubIds.has(clubId);
    if (filterMode === "following" && !(isFollowing || isOwn)) return acc;
    if ((filterMode === "own" || filterMode === "myEvents") && !isOwn) return acc;

    const metric = metricsMap.get(eventId);
    const item: EventWithMeta = {
      id: eventId,
      clubUserId: clubId,
      clubUsername: String(clubProfile.username || "").trim(),
      club: toDisplayName(clubProfile),
      clubImage: String(clubProfile.profile_image_path || "").trim(),
      university: String(clubProfile.university || "").trim(),
      title: String(row.title || "").trim(),
      description: String(row.description || "").trim(),
      image: String(row.cover_image_path || "").trim(),
      date: String(row.starts_at || "").slice(0, 10),
      startDate: String(row.starts_at || "").slice(0, 10),
      endDate: String(row.ends_at || "").slice(0, 10),
      startTime: String(row.starts_at || "").slice(11, 16),
      endTime: String(row.ends_at || "").slice(11, 16),
      location: String(row.location_name || "").trim(),
      address: String(row.address || "").trim(),
      type: String(row.event_type || "").trim(),
      category: String(row.category || "").trim(),
      categories: Array.isArray(row.categories) ? row.categories : [],
      fee: String(row.fee_label || "").trim(),
      access: String(row.access_label || "").trim(),
      capacity: Number(row.capacity || 0),
      targetAudience: String(row.target_audience || "").trim(),
      level: String(row.level || "").trim(),
      materials: String(row.materials || "").trim(),
      visibility: row.visibility,
      createdAt: String(row.created_at || ""),
      likes: Number(metric?.likes_count || 0),
      liked: likedEventIds.has(eventId),
      joined: joinedEventIds.has(eventId),
      attendees: resolveEventAttendeesCount(metric?.attendees_count, joinedEventIds.has(eventId)),
      comments: Number(metric?.comments_count || 0),
      clubIsPrivate: false,
      effectiveVisibility: row.visibility === "members_only" ? "members_only" : "public",
    };

    acc.push(item);
    return acc;
  }, []);
}

export async function fetchProfileEventsFromTable(
  eventIds: string[],
): Promise<EventWithMeta[] | null> {
  const uniqueEventIds = Array.from(
    new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (!uniqueEventIds.length) return [];

  const [
    {
      data: { user },
    },
    eventsRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("events")
      .select(
        "id,club_id,title,description,cover_image_path,starts_at,ends_at,location_name,address,event_type,category,categories,fee_label,access_label,capacity,target_audience,level,materials,visibility,created_at",
      )
      .in("id", uniqueEventIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsRes.error || !Array.isArray(eventsRes.data)) return null;
  if (!eventsRes.data.length) return [];

  const viewerId = String(user?.id || "").trim();
  const eventRows = eventsRes.data as EventTableRow[];
  const clubIds = Array.from(
    new Set(eventRows.map((row) => String(row.club_id || "").trim()).filter(Boolean)),
  );
  const profileIds = Array.from(new Set([...(viewerId ? [viewerId] : []), ...clubIds]));

  const [profilesRes, metricsRes, likesRes, joinedRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,username,name,club_name,profile_image_path,university,is_private")
      .in("user_id", profileIds)
      .is("deleted_at", null),
    supabase
      .from("event_metrics")
      .select("event_id,likes_count,attendees_count,comments_count")
      .in("event_id", uniqueEventIds),
    viewerId
      ? supabase
          .from("event_likes")
          .select("event_id")
          .eq("user_id", viewerId)
          .in("event_id", uniqueEventIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? supabase
          .from("event_attendees")
          .select("event_id")
          .eq("user_id", viewerId)
          .in("event_id", uniqueEventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesRes.error || !Array.isArray(profilesRes.data)) return null;

  const profileMap = new Map(
    (profilesRes.data || []).map((profile) => [String(profile.user_id || "").trim(), profile]),
  );
  const metricsMap = new Map(
    (
      (metricsRes.data as Array<{
        event_id?: string;
        likes_count?: number;
        attendees_count?: number;
        comments_count?: number;
      }>) || []
    ).map((metric) => [String(metric.event_id || "").trim(), metric]),
  );
  const likedEventIds = new Set(
    ((likesRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => String(row.event_id || "").trim())
      .filter(Boolean),
  );
  const joinedEventIds = new Set(
    ((joinedRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => String(row.event_id || "").trim())
      .filter(Boolean),
  );

  return eventRows.reduce<EventWithMeta[]>((acc, row) => {
    const clubId = String(row.club_id || "").trim();
    const eventId = String(row.id || "").trim();
    const clubProfile = profileMap.get(clubId);
    if (!clubId || !eventId || !clubProfile) return acc;

    const metric = metricsMap.get(eventId);
    acc.push({
      id: eventId,
      clubUserId: clubId,
      clubUsername: String(clubProfile.username || "").trim(),
      club: toDisplayName(clubProfile),
      clubImage: String(clubProfile.profile_image_path || "").trim(),
      university: String(clubProfile.university || "").trim(),
      title: String(row.title || "").trim(),
      description: String(row.description || "").trim(),
      image: String(row.cover_image_path || "").trim(),
      date: String(row.starts_at || "").slice(0, 10),
      startDate: String(row.starts_at || "").slice(0, 10),
      endDate: String(row.ends_at || "").slice(0, 10),
      startTime: String(row.starts_at || "").slice(11, 16),
      endTime: String(row.ends_at || "").slice(11, 16),
      location: String(row.location_name || "").trim(),
      address: String(row.address || "").trim(),
      type: String(row.event_type || "").trim(),
      category: String(row.category || "").trim(),
      categories: Array.isArray(row.categories) ? row.categories : [],
      fee: String(row.fee_label || "").trim(),
      access: String(row.access_label || "").trim(),
      capacity: Number(row.capacity || 0),
      targetAudience: String(row.target_audience || "").trim(),
      level: String(row.level || "").trim(),
      materials: String(row.materials || "").trim(),
      visibility: row.visibility,
      createdAt: String(row.created_at || ""),
      likes: Number(metric?.likes_count || 0),
      liked: likedEventIds.has(eventId),
      joined: joinedEventIds.has(eventId),
      attendees: resolveEventAttendeesCount(metric?.attendees_count, joinedEventIds.has(eventId)),
      comments: Number(metric?.comments_count || 0),
      clubIsPrivate: false,
      effectiveVisibility: row.visibility === "members_only" ? "members_only" : "public",
    });
    return acc;
  }, []);
}

export async function hydrateEventCommentCounts(events: EventWithMeta[]): Promise<EventWithMeta[]> {
  if (!events.length) return events;

  const eventIds = Array.from(new Set(events.map((item) => item.id).filter(Boolean)));
  if (!eventIds.length) return events;

  const { data, error } = await supabase
    .from("event_metrics")
    .select("event_id,comments_count")
    .in("event_id", eventIds);

  if (error || !Array.isArray(data)) return events;

  const commentsMap = new Map<string, number>();
  data.forEach((row) => {
    const id = String((row as { event_id?: string }).event_id || "").trim();
    if (!id) return;
    commentsMap.set(id, Number((row as { comments_count?: number }).comments_count || 0));
  });

  return events.map((item) => ({
    ...item,
    comments: commentsMap.has(item.id)
      ? Number(commentsMap.get(item.id) || 0)
      : Number(item.comments || 0),
  }));
}

export async function ensureEventCommentCounts(events: EventWithMeta[]): Promise<EventWithMeta[]> {
  if (!events.length) return events;
  if (events.every((item) => typeof item.comments === "number")) {
    return events;
  }
  return hydrateEventCommentCounts(events);
}
