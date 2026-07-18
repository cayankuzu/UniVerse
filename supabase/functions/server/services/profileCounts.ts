import type { ServerRouteDeps } from "../types.ts";

export type ProfileCounts = {
  albumsCount: number;
  eventsCount: number;
  followersCount: number;
  followingCount: number;
};

type AdminSupabase = Pick<ServerRouteDeps, "adminSupabase">["adminSupabase"];

export async function loadProfileCounts(
  adminSupabase: AdminSupabase,
  userId: string,
  accountType: "student" | "club" | null | undefined,
): Promise<ProfileCounts> {
  const [followingRes, followersRes] = await Promise.all([
    adminSupabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted"),
    adminSupabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted"),
  ]);

  if (accountType === "club") {
    const { data: eventRows } = await adminSupabase
      .from("events")
      .select("id")
      .eq("club_id", userId);
    const eventIds = Array.isArray(eventRows)
      ? eventRows.map((row: { id?: string | null }) => String(row?.id || "").trim()).filter(Boolean)
      : [];
    const albumsRes = eventIds.length
      ? await adminSupabase
          .from("album_photos")
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
      : { count: 0 };

    return {
      albumsCount: Number(albumsRes.count || 0),
      eventsCount: eventIds.length,
      followersCount: Number(followersRes.count || 0),
      followingCount: Number(followingRes.count || 0),
    };
  }

  const [eventsRes, albumsRes] = await Promise.all([
    adminSupabase
      .from("event_attendees")
      .select("event_id", { count: "exact", head: true })
      .eq("user_id", userId),
    adminSupabase
      .from("album_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    albumsCount: Number(albumsRes.count || 0),
    eventsCount: Number(eventsRes.count || 0),
    followersCount: Number(followersRes.count || 0),
    followingCount: Number(followingRes.count || 0),
  };
}
