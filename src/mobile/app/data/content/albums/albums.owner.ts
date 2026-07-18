import { supabase } from "../../../platform/supabase";
import type { AlbumPhotoWithMeta } from "./albums.shared";
import { toDisplayName } from "../../profile/profileDisplay";

function uniqueUserIds(items: AlbumPhotoWithMeta[]) {
  return Array.from(new Set(items.map((item) => String(item.userId || "").trim()).filter(Boolean)));
}

function uniqueEventIds(items: AlbumPhotoWithMeta[]) {
  return Array.from(
    new Set(items.map((item) => String(item.eventId || "").trim()).filter(Boolean)),
  );
}

export async function hydrateAlbumOwnerProfiles(
  items: AlbumPhotoWithMeta[],
): Promise<AlbumPhotoWithMeta[]> {
  const userIds = uniqueUserIds(items);
  const eventIds = uniqueEventIds(items);
  if (!userIds.length && !eventIds.length) return items;

  const eventsPromise = eventIds.length
    ? supabase.from("events").select("id,club_id").in("id", eventIds)
    : Promise.resolve({ data: [], error: null } as const);

  const [eventsRes, profilesRes] = await Promise.all([
    eventsPromise,
    userIds.length
      ? supabase
          .from("profiles")
          .select("user_id,username,name,club_name,profile_image_path,university,is_private")
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);

  const eventMap = new Map(
    (eventsRes.data || []).map((event) => [
      String(event.id || "").trim(),
      String(event.club_id || "").trim(),
    ]),
  );
  const clubIds = Array.from(new Set(Array.from(eventMap.values()).filter(Boolean)));
  const missingClubIds = clubIds.filter((clubId) => !userIds.includes(clubId));
  const clubProfilesRes = missingClubIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,username,name,club_name,profile_image_path,university,is_private")
        .in("user_id", missingClubIds)
    : ({ data: [], error: null } as const);

  if (profilesRes.error && clubProfilesRes.error) return items;

  const profiles = [...(profilesRes.data || []), ...(clubProfilesRes.data || [])];
  if (!profiles.length) return items;

  const profileMap = new Map(
    profiles.map((profile) => [String(profile.user_id || "").trim(), profile]),
  );

  return items.map((item) => {
    const profile = profileMap.get(String(item.userId || "").trim());
    const eventClubId =
      String(item.clubUserId || "").trim() || eventMap.get(String(item.eventId || "").trim()) || "";
    const clubProfile = eventClubId ? profileMap.get(eventClubId) : null;
    if (!profile && !clubProfile) return item;
    const name = profile ? toDisplayName(profile) : "";
    const university = String(profile?.university || "").trim();
    return {
      ...item,
      username: String(profile?.username || item.username || "").trim(),
      name: name || item.name,
      userImage: String(profile?.profile_image_path || item.userImage || "").trim(),
      userUniversity: university || item.userUniversity || "",
      uploaderIsPrivate:
        typeof profile?.is_private === "boolean"
          ? Boolean(profile.is_private)
          : item.uploaderIsPrivate,
      clubUserId: eventClubId || item.clubUserId,
      clubUsername: String(clubProfile?.username || item.clubUsername || "").trim() || undefined,
      clubIsPrivate: false,
      ...(university ? { university } : {}),
    };
  });
}
