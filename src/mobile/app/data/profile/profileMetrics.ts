import { supabase } from "../../platform/supabase";
import { getProfileSummary } from "./profileLookup";

export interface ProfileMetrics {
  followersCount: number;
  followingCount: number;
  albumsCount: number;
  eventsCount: number;
}

export async function loadProfileMetrics(userId: string): Promise<ProfileMetrics> {
  const summary = await getProfileSummary(userId).catch(() => null);
  if (summary) {
    return {
      followersCount: Number(summary.followers_count || 0),
      followingCount: Number(summary.following_count || 0),
      albumsCount: Number(summary.albums_count || 0),
      eventsCount: Number(summary.events_count || 0),
    };
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("user_id", userId)
    .maybeSingle();

  const accountType = profileRow?.account_type === "club" ? "club" : "student";
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted")
      .is("deleted_at", null),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted")
      .is("deleted_at", null),
  ]);

  if (accountType === "club") {
    const { data: eventRows } = await supabase
      .from("events")
      .select("id")
      .eq("club_id", userId)
      .is("deleted_at", null);
    const eventIds = Array.isArray(eventRows)
      ? eventRows.map((row) => String(row.id || "").trim()).filter(Boolean)
      : [];
    const { count: albumsCount } = eventIds.length
      ? await supabase
          .from("album_photos")
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
          .is("deleted_at", null)
      : { count: 0 };

    return {
      followersCount: followersRes.count || 0,
      followingCount: followingRes.count || 0,
      albumsCount: albumsCount || 0,
      eventsCount: eventIds.length,
    };
  }

  const [eventsRes, albumsRes] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("event_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("album_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  return {
    followersCount: followersRes.count || 0,
    followingCount: followingRes.count || 0,
    albumsCount: albumsRes.count || 0,
    eventsCount: eventsRes.count || 0,
  };
}
