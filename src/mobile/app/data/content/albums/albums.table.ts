import { supabase } from "../../../platform/supabase";
import { canViewAlbum, type RelationSnapshot } from "../../policies/visibility";
import { resolveAlbumSurfaceVisibility } from "../../normalizers/albums";
import { resolveProfileIdByUsername } from "../../profile/profileLookup";
import { toDisplayName } from "../../profile/profileDisplay";
import type { AlbumListContext, AlbumPhotoTableRow, AlbumPhotoWithMeta } from "./albums.types";

type HydrateAlbumPhotoOptions = {
  bypassProfileVisibility?: boolean;
};

type EventTableRow = {
  club_id?: string | null;
  id?: string | null;
  title?: string | null;
  visibility?: "public" | "members_only" | null;
};

function resolveViewerUsername(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null,
  profileMap: Map<string, Record<string, unknown>>,
): string {
  if (!user) return "";
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fromProfile = String(profileMap.get(user.id)?.username || "")
    .trim()
    .toLowerCase();
  if (fromProfile) return fromProfile;

  return (
    [
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
      .filter(Boolean)[0] || ""
  );
}

async function hydrateAlbumPhotosFromTable(
  photoRows: AlbumPhotoTableRow[],
  context: AlbumListContext,
  options: HydrateAlbumPhotoOptions = {},
): Promise<AlbumPhotoWithMeta[] | null> {
  if (!photoRows.length) return [];

  const eventIds = Array.from(
    new Set(photoRows.map((row) => String(row.event_id || "").trim()).filter(Boolean)),
  );
  const photoIds = Array.from(
    new Set(photoRows.map((row) => String(row.id || "").trim()).filter(Boolean)),
  );
  const uploaderIds = Array.from(
    new Set(photoRows.map((row) => String(row.user_id || "").trim()).filter(Boolean)),
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [eventsRes, likesRes, commentsRes, viewerAttendeesRes] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from("events")
          .select("id,title,visibility,club_id")
          .in("id", eventIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as EventTableRow[], error: null }),
    supabase.from("album_photo_likes").select("photo_id,user_id").in("photo_id", photoIds),
    supabase.from("album_photo_comments").select("photo_id").in("photo_id", photoIds),
    user?.id && eventIds.length > 0
      ? supabase
          .from("event_attendees")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (eventsRes.error || !Array.isArray(eventsRes.data)) return null;

  const clubIds = Array.from(
    new Set(eventsRes.data.map((row) => String(row.club_id || "").trim()).filter(Boolean)),
  );
  const profileIds = Array.from(
    new Set([...(user?.id ? [user.id] : []), ...uploaderIds, ...clubIds].filter(Boolean)),
  );
  const profilesRes =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id,username,name,club_name,profile_image_path,university,is_private")
          .in("user_id", profileIds)
          .is("deleted_at", null)
      : { data: [], error: null };
  if (profilesRes.error || !Array.isArray(profilesRes.data)) return null;

  let followingRows: Array<{ following_id: string }> = [];
  if (user?.id) {
    const [followingRes] = await Promise.all([
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted")
        .is("deleted_at", null),
    ]);
    followingRows = Array.isArray(followingRes.data) ? followingRes.data : [];
  }

  const eventMap = new Map(eventsRes.data.map((row) => [String(row.id || "").trim(), row]));
  const profileMap = new Map(
    profilesRes.data.map((row) => [String(row.user_id || "").trim(), row]),
  );
  const currentUsername = resolveViewerUsername(user, profileMap);
  const followingUsernames = followingRows
    .map((row) =>
      String(profileMap.get(String(row.following_id || "").trim())?.username || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  const likeCountMap = new Map<string, number>();
  (likesRes.data || []).forEach((row) => {
    const photoId = String(row.photo_id || "").trim();
    if (photoId) likeCountMap.set(photoId, (likeCountMap.get(photoId) || 0) + 1);
  });
  const commentCountMap = new Map<string, number>();
  (commentsRes.data || []).forEach((row) => {
    const photoId = String(row.photo_id || "").trim();
    if (photoId) commentCountMap.set(photoId, (commentCountMap.get(photoId) || 0) + 1);
  });
  const likedPhotoIds = new Set(
    (likesRes.data || [])
      .filter((row) => String(row.user_id || "").trim() === String(user?.id || "").trim())
      .map((row) => String(row.photo_id || "").trim())
      .filter(Boolean),
  );
  const joinedEventIds = new Set(
    ((viewerAttendeesRes.data as Array<{ event_id?: string }>) || [])
      .map((row) => String(row.event_id || "").trim())
      .filter(Boolean),
  );

  return photoRows.reduce<AlbumPhotoWithMeta[]>((acc, row) => {
    const photoId = String(row.id || "").trim();
    const eventId = String(row.event_id || "").trim();
    const event = eventId ? eventMap.get(eventId) : undefined;
    const hasLiveEvent = Boolean(eventId && event);
    if (!photoId) return acc;

    const uploaderProfile = profileMap.get(String(row.user_id || "").trim());
    const clubProfile = hasLiveEvent ? profileMap.get(String(event?.club_id || "").trim()) : null;
    const images =
      Array.isArray(row.media_paths) && row.media_paths.length > 0
        ? row.media_paths.map((item) => String(item || "").trim()).filter(Boolean)
        : [String(row.storage_path || "").trim()].filter(Boolean);
    const eventVisibility =
      hasLiveEvent && event?.visibility === "members_only"
        ? "members_only"
        : row.event_visibility_snapshot === "members_only"
          ? "members_only"
          : "public";
    const clubIsPrivate = hasLiveEvent
      ? Boolean(clubProfile?.is_private)
      : Boolean(row.club_is_private_snapshot);
    const visibility = resolveAlbumSurfaceVisibility({
      showOnClubProfile: row.show_on_club_profile ?? undefined,
      showOnOwnProfile: row.show_on_user_profile ?? undefined,
      showOnProfile: Boolean(row.show_on_profile),
    });
    const orphanedCapabilities = !hasLiveEvent
      ? {
          canDiscoverAlbum: context === "profile",
          canInteractAlbum: context === "profile",
          canOpenAlbum: context === "profile",
          canOpenAlbumEventDetail: false,
          lockedReasonCode: "EVENT_REMOVED" as const,
          lockedReasonText: "Bu albümün bağlı olduğu etkinlik artık mevcut değil.",
        }
      : {};

    const item: AlbumPhotoWithMeta = {
      id: photoId,
      userId: String(row.user_id || "").trim(),
      username: String(uploaderProfile?.username || "").trim(),
      name: String(uploaderProfile ? toDisplayName(uploaderProfile) : "").trim(),
      userImage: String(uploaderProfile?.profile_image_path || "").trim(),
      userUniversity: String(uploaderProfile?.university || "").trim(),
      clubName: hasLiveEvent
        ? clubProfile
          ? toDisplayName(clubProfile)
          : undefined
        : String(row.club_name_snapshot || "").trim() || undefined,
      eventId,
      eventTitle: hasLiveEvent
        ? String(event?.title || "").trim()
        : String(row.event_title_snapshot || row.title || "Album").trim(),
      image: String(row.storage_path || images[0] || "").trim(),
      images,
      photoCount: images.length || 1,
      caption: row.caption ? String(row.caption).trim() : undefined,
      createdAt: String(row.created_at || ""),
      likes: likeCountMap.get(photoId) || 0,
      liked: likedPhotoIds.has(photoId),
      comments: commentCountMap.get(photoId) || 0,
      title: row.title ? String(row.title).trim() : undefined,
      showOnOwnProfile: visibility.showOnOwnProfile,
      showOnClubProfile: visibility.showOnClubProfile,
      showOnProfile: visibility.showOnProfile,
      surfaceVisibility: visibility,
      eventVisibility,
      effectiveVisibility:
        eventVisibility === "members_only"
          ? "members_only"
          : !hasLiveEvent
            ? uploaderProfile?.is_private
              ? "followers_only"
              : "public"
            : clubIsPrivate
              ? "followers_only"
              : "public",
      clubUserId: hasLiveEvent ? String(event?.club_id || "").trim() : undefined,
      clubUsername: hasLiveEvent
        ? clubProfile?.username
          ? String(clubProfile.username).trim()
          : undefined
        : String(row.club_username_snapshot || "").trim() || undefined,
      clubIsPrivate,
      uploaderIsPrivate: Boolean(uploaderProfile?.is_private),
      viewerJoinedEvent: eventId ? joinedEventIds.has(eventId) : false,
      ...orphanedCapabilities,
    };
    const relation: RelationSnapshot = {
      clubIsPrivate,
      uploaderIsPrivate: Boolean(uploaderProfile?.is_private),
      followingUsernames,
    };
    if (
      !options.bypassProfileVisibility &&
      !canViewAlbum(currentUsername, item, context, relation).canView
    ) {
      return acc;
    }
    acc.push(item);
    return acc;
  }, []);
}

export async function fetchProfilePhotosFromTable(
  username: string,
  targetUserIdHint?: string | null,
): Promise<AlbumPhotoWithMeta[] | null> {
  const targetUserId =
    String(targetUserIdHint || "").trim() || (await resolveProfileIdByUsername(username));
  if (!targetUserId) return null;
  const { data: canViewData, error: canViewError } = await supabase.rpc("can_view_profile", {
    target_id: targetUserId,
  });
  if (!canViewError && !canViewData) return [];

  const { data: photoRows, error: photoError } = await supabase
    .from("album_photos")
    .select(
      "id,event_id,user_id,storage_path,media_paths,caption,title,event_title_snapshot,event_visibility_snapshot,club_name_snapshot,club_username_snapshot,club_is_private_snapshot,show_on_profile,show_on_user_profile,show_on_club_profile,created_at",
    )
    .eq("user_id", targetUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (photoError || !Array.isArray(photoRows)) return null;
  if (!photoRows.length) return [];
  const hydrated = await hydrateAlbumPhotosFromTable(photoRows as AlbumPhotoTableRow[], "profile", {
    bypassProfileVisibility: true,
  });
  return (
    hydrated?.filter((item) => resolveAlbumSurfaceVisibility(item).showOnOwnProfile) ?? hydrated
  );
}

export async function fetchClubProfilePhotosFromTable(
  username: string,
  targetUserIdHint?: string | null,
): Promise<AlbumPhotoWithMeta[] | null> {
  const targetUserId =
    String(targetUserIdHint || "").trim() || (await resolveProfileIdByUsername(username));
  if (!targetUserId) return null;

  const { data: canViewData, error: canViewError } = await supabase.rpc("can_view_profile", {
    target_id: targetUserId,
  });
  if (!canViewError && !canViewData) return [];

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (profileError) return null;
  if (profileRow?.account_type !== "club") return [];

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("club_id", targetUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (eventError || !Array.isArray(eventRows)) return null;

  const eventIds = eventRows.map((row) => String(row.id || "").trim()).filter(Boolean);
  if (!eventIds.length) return [];
  const items = await fetchEventPhotosFromTable(eventIds, "profile", {
    bypassProfileVisibility: true,
  });
  return items?.filter((item) => resolveAlbumSurfaceVisibility(item).showOnClubProfile) ?? items;
}

export async function fetchJoinedProfilePhotosFromTable(
  username: string,
  targetUserIdHint?: string | null,
): Promise<AlbumPhotoWithMeta[] | null> {
  const targetUserId =
    String(targetUserIdHint || "").trim() || (await resolveProfileIdByUsername(username));
  if (!targetUserId) return null;

  const { data: attendeeRows, error } = await supabase
    .from("event_attendees")
    .select("event_id")
    .eq("user_id", targetUserId);
  if (error || !Array.isArray(attendeeRows)) return null;

  const eventIds = attendeeRows.map((row) => String(row.event_id || "").trim()).filter(Boolean);
  return eventIds.length ? fetchEventPhotosFromTable(eventIds, "profile") : [];
}

export async function fetchEventPhotosFromTable(
  eventIds: string[],
  context: "feed" | "profile" | "event_album",
  options: HydrateAlbumPhotoOptions = {},
): Promise<AlbumPhotoWithMeta[] | null> {
  const uniqueEventIds = Array.from(
    new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (!uniqueEventIds.length) return [];

  const { data: photoRows, error } = await supabase
    .from("album_photos")
    .select(
      "id,event_id,user_id,storage_path,media_paths,caption,title,event_title_snapshot,event_visibility_snapshot,club_name_snapshot,club_username_snapshot,club_is_private_snapshot,show_on_profile,show_on_user_profile,show_on_club_profile,created_at",
    )
    .in("event_id", uniqueEventIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(photoRows)) return null;
  return photoRows.length
    ? hydrateAlbumPhotosFromTable(photoRows as AlbumPhotoTableRow[], context, options)
    : [];
}

export async function fetchFeedPhotosFromTable(
  context: "feed" | "search" = "feed",
  options: {
    limit?: number;
  } = {},
): Promise<AlbumPhotoWithMeta[] | null> {
  let query = supabase
    .from("album_photos")
    .select(
      "id,event_id,user_id,storage_path,media_paths,caption,title,event_title_snapshot,event_visibility_snapshot,club_name_snapshot,club_username_snapshot,club_is_private_snapshot,show_on_profile,show_on_user_profile,show_on_club_profile,created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const limit = Number(options.limit || 0);
  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(Math.max(1, Math.min(Math.trunc(limit), 200)));
  }

  const { data: photoRows, error } = await query;

  if (error || !Array.isArray(photoRows)) return null;
  return photoRows.length
    ? hydrateAlbumPhotosFromTable(photoRows as AlbumPhotoTableRow[], context)
    : [];
}
