import type { SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.ts";
import {
  listAllPhotosFromKv,
  normalizeKvPhotoEventId,
  normalizeKvPhotoImages,
} from "./albumRouteHelpers.ts";
import type {
  EnrichedKvEventRecord,
  KvAlbumPhotoRecord,
  KvBooleanRecord,
  KvCommentRecord,
  KvEventRecord,
  KvFollowRecord,
  KvProfileRecord,
} from "../types.ts";
import { resolveCompatProfilePrivacy } from "./compatProfilePrivacy.ts";
import { normalizeAlbumSurfaceVisibility } from "./albumsSurfaceHelpers.ts";
import type {
  AlbumResponseRecord,
  DbEventRow,
  PhotoModerationContext,
} from "./albumsRouteContext.ts";

type EventMapEntry = { clubProfile: KvProfileRecord | null; event: KvEventRecord };
type BlockedStateReader = {
  isBlockedPair: (viewerId: string, targetId: string) => Promise<boolean>;
};

export function createAlbumContextOperations(params: {
  adminSupabase: SupabaseClient;
  blockedState: BlockedStateReader;
  generateId: () => string;
  getProfile: (userId: string) => Promise<KvProfileRecord | null>;
}) {
  const { adminSupabase, blockedState, generateId, getProfile } = params;

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
    const isOwnClub = Boolean(viewerId) && String(event.clubUserId || "").trim() === viewerId;
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

  const getDiscoverableEventMap = async (viewerId: string) => {
    const { followingUsernames } = await getViewerRelations(viewerId);
    const eventIds = await kv.get<string[]>("all_events").then((value) => value || []);
    if (eventIds.length === 0) return new Map<string, EventMapEntry>();
    const events = (
      await Promise.all(eventIds.map((id) => kv.get<KvEventRecord>(`event:${id}`)))
    ).filter(Boolean) as KvEventRecord[];
    const clubProfiles = await Promise.all(
      events.map((event) => getProfile(String(event.clubUserId || "").trim())),
    );

    const map = new Map<string, EventMapEntry>();
    events.forEach((event, index) => {
      const clubProfile = clubProfiles[index];
      if (!canDiscoverEventCard(viewerId, event, clubProfile, followingUsernames)) {
        return;
      }
      map.set(String(event.id || "").trim(), { event, clubProfile });
    });
    return map;
  };

  const findPhotoById = async (photoId: string) => {
    const allPhotos = await listAllPhotosFromKv();
    return allPhotos.find((item) => String(item.id || "").trim() === photoId) || null;
  };

  const getPhotoModerationContext = async (
    photoId: string,
  ): Promise<PhotoModerationContext | null> => {
    const normalizedPhotoId = String(photoId || "").trim();
    if (!normalizedPhotoId) return null;
    const dbPhotoRes = await adminSupabase
      .from("album_photos")
      .select("id,user_id,event_id")
      .eq("id", normalizedPhotoId)
      .maybeSingle();
    const kvPhoto = await findPhotoById(normalizedPhotoId);
    const photoUserId = String(dbPhotoRes.data?.user_id || kvPhoto?.userId || "").trim();
    const eventId = String(
      dbPhotoRes.data?.event_id || normalizeKvPhotoEventId(kvPhoto) || "",
    ).trim();
    if (!photoUserId && !eventId && !kvPhoto && !dbPhotoRes.data) return null;
    let clubUserId = "";
    if (eventId) {
      const dbEventRes = await adminSupabase
        .from("events")
        .select("club_id")
        .eq("id", eventId)
        .maybeSingle();
      clubUserId = String(dbEventRes.data?.club_id || "").trim();
      if (!clubUserId) {
        const kvEvent = await kv.get<KvEventRecord>(`event:${eventId}`);
        clubUserId = String(kvEvent?.clubUserId || "").trim();
      }
    }

    return {
      photoUserId,
      eventId,
      clubUserId,
      kvPhoto,
    };
  };

  const canDeletePhotoContent = (viewerId: string, ownerId: string, clubOwnerId: string) =>
    Boolean(viewerId) &&
    ((ownerId && String(viewerId) === String(ownerId)) ||
      (clubOwnerId && String(viewerId) === String(clubOwnerId)));

  const canUploadAlbumToEvent = async (viewerId: string, rawEventId: string) => {
    const eventId = String(rawEventId || "").trim();
    if (!viewerId || !eventId) {
      return { allowed: false, reason: "Etkinlik bulunamadi." };
    }
    const [dbEventRes, kvEvent] = await Promise.all([
      adminSupabase.from("events").select("id,club_id").eq("id", eventId).maybeSingle(),
      kv.get<KvEventRecord>(`event:${eventId}`),
    ]);

    const dbEvent = dbEventRes.data as DbEventRow | null;
    const clubUserId = String(dbEvent?.club_id || kvEvent?.clubUserId || "").trim();
    if (!dbEvent?.id && !kvEvent?.id) {
      return { allowed: false, reason: "Etkinlik bulunamadi." };
    }
    if (clubUserId === viewerId) {
      return { allowed: true, reason: "" };
    }

    const attendeeRes = await adminSupabase
      .from("event_attendees")
      .select("event_id")
      .eq("event_id", eventId)
      .eq("user_id", viewerId)
      .maybeSingle();
    if (attendeeRes.data) {
      return { allowed: true, reason: "" };
    }

    return {
      allowed: false,
      reason: "Bu albume sadece etkinlik sahibi kulup ve katilimcilar fotograf yukleyebilir.",
    };
  };

  const syncKvPhotosToSql = async (rawEventIds: string[]) => {
    const eventIds = Array.from(
      new Set(rawEventIds.map((item) => String(item || "").trim()).filter(Boolean)),
    );
    if (!eventIds.length) return 0;
    const allKvPhotos = await listAllPhotosFromKv();
    const candidatePhotos = allKvPhotos.filter((photo) =>
      eventIds.includes(normalizeKvPhotoEventId(photo)),
    );
    if (!candidatePhotos.length) return 0;
    let synced = 0;
    for (const photo of candidatePhotos) {
      const photoId = String(photo.id || "").trim() || generateId();
      const eventId = normalizeKvPhotoEventId(photo);
      const userId = String(photo.userId || "").trim();
      const images = normalizeKvPhotoImages(photo);
      if (!eventId || !userId || !images.length) continue;
      const visibility = normalizeAlbumSurfaceVisibility(photo);
      const row = {
        id: photoId,
        event_id: eventId,
        user_id: userId,
        storage_path: images[0],
        media_paths: images,
        caption: String(photo.caption || "").trim(),
        title: String(photo.title || "").trim() || null,
        show_on_club_profile: visibility.showOnClubProfile,
        show_on_profile: visibility.showOnOwnProfile || visibility.showOnClubProfile,
        show_on_user_profile: visibility.showOnOwnProfile,
        created_at: String(photo.createdAt || "").trim() || new Date().toISOString(),
      };

      const { error } = await adminSupabase
        .from("album_photos")
        .upsert(row, { onConflict: "id" })
        .select("id")
        .single();

      if (!error) {
        synced += 1;
      }
    }

    return synced;
  };

  const buildAlbumResponse = async (params: {
    comments: KvCommentRecord[];
    event: KvEventRecord | null;
    photo: KvAlbumPhotoRecord;
    viewerId: string;
  }): Promise<AlbumResponseRecord> => {
    const uploaderId = String(params.photo.userId || "").trim();
    const eventId = normalizeKvPhotoEventId(params.photo);
    const [likes, uploaderProfile, clubProfile] = await Promise.all([
      kv.get<KvBooleanRecord>(`photolikes:${params.photo.id}`).then((value) => value || {}),
      getProfile(uploaderId),
      getProfile(String(params.event?.clubUserId || "").trim()),
    ]);
    const images = normalizeKvPhotoImages(params.photo);
    const visibility = normalizeAlbumSurfaceVisibility(params.photo);
    return {
      ...params.photo,
      clubIsPrivate: resolveCompatProfilePrivacy(clubProfile?.accountType, clubProfile?.isPrivate),
      clubUserId: String(params.event?.clubUserId || "").trim() || undefined,
      clubUsername: params.event?.clubUsername || "",
      comments: params.comments.length,
      effectiveVisibility: "public",
      eventId,
      eventTitle: params.photo.eventTitle || params.event?.title || "",
      eventVisibility: "public",
      images,
      liked: Boolean(likes[params.viewerId]),
      likes: Object.values(likes).filter(Boolean).length,
      name:
        params.photo.name ||
        uploaderProfile?.name ||
        uploaderProfile?.clubName ||
        uploaderProfile?.username ||
        "",
      photoCount: images.length || 1,
      showOnClubProfile: visibility.showOnClubProfile,
      showOnOwnProfile: visibility.showOnOwnProfile,
      showOnProfile: visibility.showOnOwnProfile || visibility.showOnClubProfile,
      uploaderIsPrivate: resolveCompatProfilePrivacy(
        uploaderProfile?.accountType,
        uploaderProfile?.isPrivate,
      ),
      userImage: params.photo.userImage || uploaderProfile?.profileImage || "",
      userUniversity: params.photo.userUniversity || uploaderProfile?.university || "",
      username: params.photo.username || uploaderProfile?.username || "",
    };
  };

  return {
    buildAlbumResponse,
    canDeletePhotoContent,
    canUploadAlbumToEvent,
    decorateEventVisibility,
    filterBlockedEvents,
    findPhotoById,
    getDiscoverableEventMap,
    getPhotoModerationContext,
    getViewerRelations,
    syncKvPhotosToSql,
  };
}
