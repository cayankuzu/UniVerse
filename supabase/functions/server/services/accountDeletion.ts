import type { SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.ts";
import { normalizeKvPhotoImages } from "../routes/albumRouteHelpers.ts";
import { listKvRowsByPrefix } from "./kvStoreScan.ts";
import type {
  KvAlbumPhotoRecord,
  KvBlockedRecord,
  KvBooleanRecord,
  KvCommentRecord,
  KvEventRecord,
  KvFollowRecord,
  KvFollowRequestRecord,
  KvNotificationRecord,
  KvProfileRecord,
  KvReportRecord,
} from "../types.ts";

export type UserDeletionContext = {
  accountType?: string;
  preservedAlbums?: Array<{ eventTitle: string; photoId: string }>;
  storagePaths: string[];
};

function normalizeStoragePaths(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function collectKvPhotoPaths(photo: KvAlbumPhotoRecord): string[] {
  const images = normalizeKvPhotoImages(photo);
  const primaryImage = String(photo?.image || "").trim();
  return normalizeStoragePaths(primaryImage ? [...images, primaryImage] : images);
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function buildUserDeletionContext(params: {
  adminSupabase: SupabaseClient;
  userId: string;
}): Promise<UserDeletionContext> {
  const normalizedUserId = String(params.userId || "").trim();
  if (!normalizedUserId) {
    return { storagePaths: [] };
  }

  const [profileRes, eventRes, mediaAssetRes] = await Promise.all([
    params.adminSupabase
      .from("profiles")
      .select("account_type,profile_image_path,cover_image_path")
      .eq("user_id", normalizedUserId)
      .maybeSingle(),
    params.adminSupabase
      .from("events")
      .select("id,title,cover_image_path")
      .eq("club_id", normalizedUserId),
    params.adminSupabase
      .from("media_assets")
      .select("object_path")
      .eq("owner_id", normalizedUserId),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (eventRes.error) throw new Error(eventRes.error.message);
  if (mediaAssetRes.error) throw new Error(mediaAssetRes.error.message);

  const ownedEventIds = Array.isArray(eventRes.data)
    ? eventRes.data
        .map((row: { id?: string | null }) => String(row?.id || "").trim())
        .filter(Boolean)
    : [];

  const [ownPhotoRes, preservedEventPhotoRes] = await Promise.all([
    params.adminSupabase
      .from("album_photos")
      .select("storage_path,media_paths")
      .eq("user_id", normalizedUserId),
    ownedEventIds.length > 0
      ? params.adminSupabase
          .from("album_photos")
          .select("id,event_id,user_id")
          .in("event_id", ownedEventIds)
          .neq("user_id", normalizedUserId)
      : Promise.resolve({
          data: [] as Array<{
            event_id?: string | null;
            id?: string | null;
            user_id?: string | null;
          }>,
          error: null,
        }),
  ]);

  if (ownPhotoRes.error) throw new Error(ownPhotoRes.error.message);
  if (preservedEventPhotoRes.error) throw new Error(preservedEventPhotoRes.error.message);

  const profilePaths = profileRes.data
    ? [profileRes.data.profile_image_path, profileRes.data.cover_image_path]
    : [];
  const eventPaths = Array.isArray(eventRes.data)
    ? eventRes.data.map((row: { cover_image_path?: string | null }) => row?.cover_image_path)
    : [];
  const photoPaths = (ownPhotoRes.data || []).flatMap(
    (row: { media_paths?: string[] | null; storage_path?: string | null }) => {
      const mediaPaths = Array.isArray(row?.media_paths) ? row.media_paths : [];
      return [row?.storage_path, ...mediaPaths];
    },
  );
  const assetPaths = Array.isArray(mediaAssetRes.data)
    ? mediaAssetRes.data.map((row: { object_path?: string | null }) => row?.object_path)
    : [];
  const eventTitleById = new Map(
    (Array.isArray(eventRes.data) ? eventRes.data : []).map(
      (row: { id?: string | null; title?: string | null }) => [
        String(row?.id || "").trim(),
        String(row?.title || "").trim(),
      ],
    ),
  );
  const preservedAlbums = (
    Array.isArray(preservedEventPhotoRes.data) ? preservedEventPhotoRes.data : []
  )
    .map((row) => ({
      eventTitle: eventTitleById.get(String(row?.event_id || "").trim()) || "Album",
      photoId: String(row?.id || "").trim(),
    }))
    .filter((row) => row.photoId);

  return {
    accountType:
      String(profileRes.data?.account_type || "")
        .trim()
        .toLowerCase() || undefined,
    preservedAlbums,
    storagePaths: normalizeStoragePaths([
      ...profilePaths,
      ...eventPaths,
      ...photoPaths,
      ...assetPaths,
    ]),
  };
}

export async function purgeUserAccountData(params: {
  adminSupabase: SupabaseClient;
  context?: UserDeletionContext | null;
  kvTable: string;
  mediaBucket: string;
  normalizeEmail: (value: string) => string;
  normalizeUsername: (value: string) => string;
  userId: string;
}) {
  const profile = await kv.get<KvProfileRecord>(`profile:${params.userId}`);
  const username = params.normalizeUsername(profile?.username || "");
  const email = params.normalizeEmail(profile?.email || "");
  const storagePaths = new Set<string>(normalizeStoragePaths(params.context?.storagePaths || []));
  const preservedAlbums = Array.isArray(params.context?.preservedAlbums)
    ? params.context?.preservedAlbums || []
    : [];
  const isClubDeletion =
    String(params.context?.accountType || "")
      .trim()
      .toLowerCase() === "club";

  const allUsersRaw = (await kv.get<string[]>("all_users")) || [];
  const allUsers = Array.from(new Set(allUsersRaw.filter(Boolean)));
  const otherUsers = allUsers.filter((id) => id !== params.userId);
  const eventIds = new Set<string>();

  if (username) {
    const ownEventIds = (await kv.get<string[]>(`clubevents:${username}`)) || [];
    ownEventIds.forEach((id) => {
      if (id) eventIds.add(id);
    });
  }

  const eventRows = await listKvRowsByPrefix<KvEventRecord>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "event:",
  });
  eventRows.forEach((row) => {
    const rawEventId = String(row.key || "").slice("event:".length);
    const item = row.value || {};
    const eventId = String(item.id || rawEventId || "").trim();
    if (!eventId) return;
    if (
      item.clubUserId === params.userId ||
      params.normalizeUsername(item.clubUsername || "") === username
    ) {
      eventIds.add(eventId);
    }
  });

  if (allUsers.includes(params.userId)) {
    await kv.set(
      "all_users",
      allUsers.filter((id) => id !== params.userId),
    );
  }

  const allEvents = (await kv.get<string[]>("all_events")) || [];
  if (allEvents.length > 0) {
    const nextAllEvents = allEvents.filter((id) => !eventIds.has(id));
    if (nextAllEvents.length !== allEvents.length) {
      await kv.set("all_events", nextAllEvents);
    }
  }

  if (isClubDeletion && preservedAlbums.length > 0) {
    for (const preserved of preservedAlbums) {
      const { error } = await params.adminSupabase
        .from("album_photos")
        .update({
          club_is_private_snapshot: false,
          club_name_snapshot: null,
          club_username_snapshot: null,
          event_title_snapshot: preserved.eventTitle || "Album",
          event_visibility_snapshot: "public",
          show_on_club_profile: false,
          show_on_profile: true,
          show_on_user_profile: true,
        })
        .eq("id", preserved.photoId);
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const ownPhotos = (await kv.get<KvAlbumPhotoRecord[]>(`photos:${params.userId}`)) || [];
  const photoIdsToDelete = new Set<string>();
  ownPhotos.forEach((photo) => {
    const photoId = String(photo?.id || "").trim();
    if (photoId) photoIdsToDelete.add(photoId);
    collectKvPhotoPaths(photo).forEach((path) => storagePaths.add(path));
  });

  const clubEventsRows = await listKvRowsByPrefix<string[]>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "clubevents:",
  });
  for (const row of clubEventsRows) {
    const ids = Array.isArray(row.value) ? row.value : [];
    const filtered = ids.filter((id: string) => !eventIds.has(String(id)));
    if (filtered.length !== ids.length) {
      await kv.set(row.key, filtered);
    }
  }

  for (const eventId of eventIds) {
    await kv.del(`event:${eventId}`);
    await kv.del(`eventlikes:${eventId}`);
    await kv.del(`eventattendees:${eventId}`);
    await kv.del(`eventcomments:${eventId}`);
  }

  const eventLikesRows = await listKvRowsByPrefix<KvBooleanRecord>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventlikes:",
  });
  for (const row of eventLikesRows) {
    const likes = row.value && typeof row.value === "object" ? { ...row.value } : null;
    if (!likes || !(params.userId in likes)) continue;
    delete likes[params.userId];
    await kv.set(row.key, likes);
  }

  const eventAttendeesRows = await listKvRowsByPrefix<string[]>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventattendees:",
  });
  for (const row of eventAttendeesRows) {
    if (!Array.isArray(row.value)) continue;
    const filtered = row.value.filter((attendeeId: string) => attendeeId !== params.userId);
    if (filtered.length !== row.value.length) {
      await kv.set(row.key, filtered);
    }
  }

  const eventCommentsRows = await listKvRowsByPrefix<KvCommentRecord[]>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventcomments:",
  });
  for (const row of eventCommentsRows) {
    if (!Array.isArray(row.value)) continue;
    const filtered = row.value.filter((comment) => comment?.userId !== params.userId);
    if (filtered.length !== row.value.length) {
      await kv.set(row.key, filtered);
    }
  }

  const photoLikesRows = await listKvRowsByPrefix<KvBooleanRecord>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photolikes:",
  });
  for (const row of photoLikesRows) {
    const likes = row.value && typeof row.value === "object" ? { ...row.value } : null;
    if (!likes || !(params.userId in likes)) continue;
    delete likes[params.userId];
    await kv.set(row.key, likes);
  }

  const photoCommentsRows = await listKvRowsByPrefix<KvCommentRecord[]>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photocomments:",
  });
  for (const row of photoCommentsRows) {
    if (!Array.isArray(row.value)) continue;
    const filtered = row.value.filter((comment) => comment?.userId !== params.userId);
    if (filtered.length !== row.value.length) {
      await kv.set(row.key, filtered);
    }
  }

  const photosRows = await listKvRowsByPrefix<KvAlbumPhotoRecord[]>({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photos:",
  });
  for (const row of photosRows) {
    if (!Array.isArray(row.value)) continue;
    const ownerUserId = String(row.key || "").slice("photos:".length);
    if (isClubDeletion && ownerUserId && ownerUserId !== params.userId) {
      const nextPhotos = row.value.map((photo) => {
        const photoEventId = String(photo?.eventId || photo?.event_id || "");
        if (!eventIds.has(photoEventId)) return photo;
        return {
          ...photo,
          eventId: "",
          event_id: "",
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
        };
      });
      const changed = nextPhotos.some((photo, index) => photo !== row.value[index]);
      if (changed) {
        await kv.set(row.key, nextPhotos);
      }
      continue;
    }

    const removed = row.value.filter((photo) =>
      eventIds.has(String(photo?.eventId || photo?.event_id || "")),
    );
    removed.forEach((photo) => {
      const photoId = String(photo?.id || "").trim();
      if (photoId) photoIdsToDelete.add(photoId);
      collectKvPhotoPaths(photo).forEach((path) => storagePaths.add(path));
    });
    const filtered = row.value.filter(
      (photo) => !eventIds.has(String(photo?.eventId || photo?.event_id || "")),
    );
    if (filtered.length !== row.value.length) {
      await kv.set(row.key, filtered);
    }
  }

  for (const photoId of photoIdsToDelete) {
    await kv.del(`photolikes:${photoId}`);
    await kv.del(`photocomments:${photoId}`);
  }

  for (const targetUserId of otherUsers) {
    const [following, followers, sentRequests, receivedRequests, blocked, notifications] =
      await Promise.all([
        kv.get<KvFollowRecord[]>(`following:${targetUserId}`).then((v) => v || []),
        kv.get<KvFollowRecord[]>(`followers:${targetUserId}`).then((v) => v || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${targetUserId}`)
          .then((v) => v || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_received:${targetUserId}`)
          .then((v) => v || []),
        kv.get<KvBlockedRecord[]>(`blocked:${targetUserId}`).then((v) => v || []),
        kv.get<KvNotificationRecord[]>(`notifications:${targetUserId}`).then((v) => v || []),
      ]);

    const nextFollowing = following.filter((item) => item?.userId !== params.userId);
    const nextFollowers = followers.filter((item) => item?.userId !== params.userId);
    const nextSent = sentRequests.filter((item) => item?.toUserId !== params.userId);
    const nextReceived = receivedRequests.filter((item) => item?.fromUserId !== params.userId);
    const nextBlocked = blocked.filter((item) => item?.userId !== params.userId);
    const nextNotifications = notifications.filter((item) => {
      if (item?.fromUserId === params.userId) return false;
      if (eventIds.has(String(item?.eventId || ""))) return false;
      return true;
    });
    if (nextFollowing.length !== following.length) {
      await kv.set(`following:${targetUserId}`, nextFollowing);
    }
    if (nextFollowers.length !== followers.length) {
      await kv.set(`followers:${targetUserId}`, nextFollowers);
    }
    if (nextSent.length !== sentRequests.length) {
      await kv.set(`follow_requests_sent:${targetUserId}`, nextSent);
    }
    if (nextReceived.length !== receivedRequests.length) {
      await kv.set(`follow_requests_received:${targetUserId}`, nextReceived);
    }
    if (nextBlocked.length !== blocked.length) {
      await kv.set(`blocked:${targetUserId}`, nextBlocked);
    }
    if (nextNotifications.length !== notifications.length) {
      await kv.set(`notifications:${targetUserId}`, nextNotifications);
    }
  }

  const reports = (await kv.get<KvReportRecord[]>("reports")) || [];
  if (reports.length > 0) {
    const nextReports = reports.filter((report) => {
      if (report?.fromUserId === params.userId) return false;
      if (report?.targetId === params.userId) return false;
      if (username && params.normalizeUsername(report?.targetUsername || "") === username) {
        return false;
      }
      return true;
    });
    if (nextReports.length !== reports.length) {
      await kv.set("reports", nextReports);
    }
  }

  if (username) {
    await kv.del(`clubevents:${username}`);
    await kv.del(`idx:username:${username}`);
  }
  if (email) {
    await kv.del(`idx:email:${email}`);
  }

  await kv.del(`profile:${params.userId}`);
  await kv.del(`following:${params.userId}`);
  await kv.del(`followers:${params.userId}`);
  await kv.del(`follow_requests_sent:${params.userId}`);
  await kv.del(`follow_requests_received:${params.userId}`);
  await kv.del(`blocked:${params.userId}`);
  await kv.del(`notifications:${params.userId}`);
  await kv.del(`photos:${params.userId}`);

  const { error: storageError } = await params.adminSupabase
    .from("storage.objects")
    .delete()
    .eq("bucket_id", params.mediaBucket)
    .like("name", `%/${params.userId}/%`);
  if (storageError) {
    throw new Error(storageError.message);
  }

  const normalizedStoragePaths = Array.from(storagePaths);
  for (const batch of chunkValues(normalizedStoragePaths, 100)) {
    if (batch.length === 0) continue;
    const { error: mediaAssetsError } = await params.adminSupabase
      .from("media_assets")
      .delete()
      .in("object_path", batch);
    if (mediaAssetsError) {
      throw new Error(mediaAssetsError.message);
    }

    const { error: exactStorageError } = await params.adminSupabase
      .from("storage.objects")
      .delete()
      .eq("bucket_id", params.mediaBucket)
      .in("name", batch);
    if (exactStorageError) {
      throw new Error(exactStorageError.message);
    }
  }
}
