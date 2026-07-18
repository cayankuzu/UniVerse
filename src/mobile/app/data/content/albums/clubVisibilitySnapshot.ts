import { supabase } from "../../../platform/supabase";
import { normalizeAlbumLookupValue } from "./albums.shared";

export type ClubVisibilityState = {
  clubIsPrivate: boolean;
  followsClub?: boolean;
  clubUserId?: string;
  clubUsername?: string;
};

export async function fetchClubVisibilitySnapshot(params: {
  clubUsernames?: string[];
  eventIds?: string[];
  viewerId?: string;
}) {
  const clubUsernames = Array.from(
    new Set((params.clubUsernames || []).map(normalizeAlbumLookupValue).filter(Boolean)),
  );
  const eventIds = Array.from(
    new Set((params.eventIds || []).map((item) => String(item || "").trim()).filter(Boolean)),
  );

  const clubMetaByUsername: Record<string, ClubVisibilityState> = {};
  const clubMetaByEventId: Record<string, ClubVisibilityState> = {};

  let eventClubRows: Array<{ id?: string; club_id?: string }> = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("events")
      .select("id,club_id")
      .in("id", eventIds)
      .is("deleted_at", null);
    eventClubRows = Array.isArray(data) ? data : [];
  }

  const clubIdsFromEvents = eventClubRows
    .map((row) => String(row.club_id || "").trim())
    .filter(Boolean);
  const allClubIds = Array.from(new Set(clubIdsFromEvents));

  const profileQuery =
    clubUsernames.length > 0 || allClubIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id,username,is_private,account_type")
          .or(
            [
              clubUsernames.length ? `username.in.(${clubUsernames.join(",")})` : "",
              allClubIds.length ? `user_id.in.(${allClubIds.join(",")})` : "",
            ]
              .filter(Boolean)
              .join(","),
          )
          .eq("account_type", "club")
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null } as const);

  const followQuery =
    params.viewerId && allClubIds.length > 0
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", params.viewerId)
          .eq("status", "accepted")
          .is("deleted_at", null)
          .in("following_id", allClubIds)
      : Promise.resolve({ data: [], error: null } as const);

  const [profilesRes, followsRes] = await Promise.all([profileQuery, followQuery]);

  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  const follows = new Set(
    (Array.isArray(followsRes.data) ? followsRes.data : [])
      .map((row) => String((row as { following_id?: string }).following_id || "").trim())
      .filter(Boolean),
  );
  const profileByUserId = new Map(
    profiles.map((row) => [String((row as { user_id?: string }).user_id || "").trim(), row]),
  );

  profiles.forEach((row) => {
    const clubUserId = String((row as { user_id?: string }).user_id || "").trim();
    const clubUsername = normalizeAlbumLookupValue(
      String((row as { username?: string }).username || ""),
    );
    if (!clubUserId || !clubUsername) return;
    clubMetaByUsername[clubUsername] = {
      clubIsPrivate: Boolean((row as { is_private?: boolean }).is_private),
      followsClub: follows.has(clubUserId),
      clubUserId,
      clubUsername,
    };
  });

  eventClubRows.forEach((row) => {
    const eventId = String(row.id || "").trim();
    const clubUserId = String(row.club_id || "").trim();
    if (!eventId || !clubUserId) return;
    const profileRow = profileByUserId.get(clubUserId);
    const clubUsername = normalizeAlbumLookupValue(
      String((profileRow as { username?: string } | undefined)?.username || ""),
    );
    clubMetaByEventId[eventId] = {
      clubIsPrivate: Boolean((profileRow as { is_private?: boolean } | undefined)?.is_private),
      followsClub: follows.has(clubUserId),
      clubUserId,
      clubUsername: clubUsername || undefined,
    };
    if (clubUsername && !clubMetaByUsername[clubUsername]) {
      clubMetaByUsername[clubUsername] = clubMetaByEventId[eventId];
    }
  });

  return { clubMetaByEventId, clubMetaByUsername };
}
