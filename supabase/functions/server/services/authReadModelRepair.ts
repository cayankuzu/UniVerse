import { listKvRowsByPrefix } from "./kvStoreScan.ts";
import type { EdgeUser, JsonValue, ServerRouteDeps } from "../types.ts";

const NOTIFICATION_TYPES = new Set([
  "follow",
  "follow_request",
  "follow_accepted",
  "like",
  "comment",
  "event",
  "system",
]);

type AuthReadModelRepairDeps = Pick<
  ServerRouteDeps,
  "adminSupabase" | "normalizeEmail" | "normalizeUsername" | "syncProfileToTable"
>;

type AuthReadModelRepairParams = AuthReadModelRepairDeps & {
  kvTable: string;
  user: EdgeUser;
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function toIsoTimestamp(dateValue: unknown, timeValue: unknown, fallbackValue: unknown) {
  const fallback = firstText(fallbackValue) || new Date().toISOString();
  const date = firstText(dateValue);
  if (!date) return fallback;
  const time = firstText(timeValue) || "00:00";
  const candidate = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function normalizeNotificationType(value: unknown) {
  const normalized = String(value || "").trim();
  return NOTIFICATION_TYPES.has(normalized) ? normalized : "";
}

function orderCommentsForInsert(items: Record<string, JsonValue>[]) {
  const pending = [...items];
  const insertedIds = new Set<string>();
  const ordered: Record<string, JsonValue>[] = [];

  while (pending.length > 0) {
    let progressed = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index];
      const itemId = firstText(item?.id);
      const parentId = firstText(item?.parentId, item?.parent_id);
      const parentStillPending = pending.some((row) => firstText(row?.id) === parentId);
      if (!parentId || insertedIds.has(parentId) || !parentStillPending) {
        pending.splice(index, 1);
        if (itemId) insertedIds.add(itemId);
        ordered.push(item);
        progressed = true;
      }
    }
    if (!progressed) {
      ordered.push(...pending);
      break;
    }
  }

  return ordered.reverse();
}

export async function repairCurrentUserReadModel(params: AuthReadModelRepairParams) {
  const viewerId = String(params.user?.id || "").trim();
  if (!viewerId) {
    return {
      repaired: false,
      stats: {},
    };
  }

  const stats: Record<string, number> = {
    profiles: 0,
    follows: 0,
    events: 0,
    eventLikes: 0,
    eventAttendees: 0,
    eventComments: 0,
    albums: 0,
    albumLikes: 0,
    albumComments: 0,
    notifications: 0,
  };

  const profileRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "profile:",
  });
  for (const row of profileRows) {
    const profileValue = row.value || {};
    const userId = firstText(
      profileValue?.id,
      profileValue?.userId,
      row.key.slice("profile:".length),
    );
    const username = params.normalizeUsername(profileValue?.username || "");
    const email = params.normalizeEmail(profileValue?.email || "");
    if (!userId || !username || !email) continue;
    await params.syncProfileToTable({
      ...profileValue,
      id: userId,
      userId,
      username,
      email,
    });
    stats.profiles += 1;
  }

  const followingRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "following:",
  });
  for (const row of followingRows) {
    const followerId = firstText(row.key.slice("following:".length));
    const entries = Array.isArray(row.value) ? row.value : [];
    for (const item of entries) {
      const followingId = firstText(item?.userId);
      if (!followerId || !followingId || followerId === followingId) continue;
      const { error } = await params.adminSupabase.from("follows").upsert(
        {
          follower_id: followerId,
          following_id: followingId,
          status: "accepted",
          responded_at: firstText(item?.respondedAt, item?.createdAt, item?.sentAt) || null,
        },
        {
          onConflict: "follower_id,following_id",
        },
      );
      if (!error) stats.follows += 1;
    }
  }

  const followRequestRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "follow_requests_sent:",
  });
  for (const row of followRequestRows) {
    const followerId = firstText(row.key.slice("follow_requests_sent:".length));
    const entries = Array.isArray(row.value) ? row.value : [];
    for (const item of entries) {
      const followingId = firstText(item?.toUserId);
      if (!followerId || !followingId || followerId === followingId) continue;
      const { error } = await params.adminSupabase.from("follows").upsert(
        {
          follower_id: followerId,
          following_id: followingId,
          status: "pending",
          responded_at: null,
        },
        {
          onConflict: "follower_id,following_id",
        },
      );
      if (!error) stats.follows += 1;
    }
  }

  const eventRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "event:",
  });
  for (const row of eventRows) {
    const eventValue = row.value || {};
    const eventId = firstText(eventValue?.id, row.key.slice("event:".length));
    const clubId = firstText(eventValue?.clubUserId);
    if (!eventId || !clubId) continue;

    const startsAt = toIsoTimestamp(
      eventValue?.startDate || eventValue?.date,
      eventValue?.startTime,
      eventValue?.createdAt,
    );
    const endsAt = toIsoTimestamp(
      eventValue?.endDate || eventValue?.startDate || eventValue?.date,
      eventValue?.endTime,
      startsAt,
    );

    const { error } = await params.adminSupabase.from("events").upsert(
      {
        id: eventId,
        club_id: clubId,
        title: firstText(eventValue?.title) || "Etkinlik",
        description: firstText(eventValue?.description) || "Aciklama bulunmuyor",
        starts_at: startsAt,
        ends_at: endsAt,
        location_name: firstText(eventValue?.location) || "Belirtilmedi",
        address: firstText(eventValue?.address) || "Belirtilmedi",
        event_type: firstText(eventValue?.type) || "general",
        category: firstText(eventValue?.category) || "general",
        categories:
          Array.isArray(eventValue?.categories) && eventValue.categories.length > 0
            ? eventValue.categories.filter(Boolean)
            : [firstText(eventValue?.category) || "general"],
        fee_label: firstText(eventValue?.fee) || "ucretsiz",
        access_label: firstText(eventValue?.access) || "herkese acik",
        capacity:
          Number.isFinite(Number(eventValue?.capacity)) && Number(eventValue?.capacity) > 0
            ? Number(eventValue.capacity)
            : null,
        target_audience: firstText(eventValue?.targetAudience) || null,
        level: firstText(eventValue?.level) || null,
        materials: firstText(eventValue?.materials) || null,
        visibility: "public",
        cover_image_path: firstText(eventValue?.image) || null,
        is_cancelled: Boolean(eventValue?.isCancelled),
        created_at: firstText(eventValue?.createdAt) || startsAt,
        updated_at: firstText(eventValue?.updatedAt, eventValue?.createdAt) || startsAt,
        updated_by: clubId,
      },
      {
        onConflict: "id",
      },
    );
    if (!error) stats.events += 1;
  }

  const eventLikeRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventlikes:",
  });
  for (const row of eventLikeRows) {
    const eventId = firstText(row.key.slice("eventlikes:".length));
    const likes = row.value && typeof row.value === "object" ? row.value : {};
    for (const [userId, liked] of Object.entries(likes)) {
      if (!liked || !eventId || !userId) continue;
      const { error } = await params.adminSupabase.from("event_likes").upsert(
        {
          event_id: eventId,
          user_id: userId,
        },
        {
          onConflict: "event_id,user_id",
        },
      );
      if (!error) stats.eventLikes += 1;
    }
  }

  const eventAttendeeRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventattendees:",
  });
  for (const row of eventAttendeeRows) {
    const eventId = firstText(row.key.slice("eventattendees:".length));
    const attendeeIds = Array.isArray(row.value) ? row.value : [];
    for (const attendeeId of attendeeIds) {
      const normalizedAttendeeId = firstText(attendeeId);
      if (!eventId || !normalizedAttendeeId) continue;
      const { error } = await params.adminSupabase.from("event_attendees").upsert(
        {
          event_id: eventId,
          user_id: normalizedAttendeeId,
        },
        {
          onConflict: "event_id,user_id",
        },
      );
      if (!error) stats.eventAttendees += 1;
    }
  }

  const eventCommentRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "eventcomments:",
  });
  for (const row of eventCommentRows) {
    const eventId = firstText(row.key.slice("eventcomments:".length));
    const comments = orderCommentsForInsert(Array.isArray(row.value) ? row.value : []);
    const knownCommentIds = new Set(comments.map((item) => firstText(item?.id)).filter(Boolean));
    for (const comment of comments) {
      const commentId = firstText(comment?.id);
      const userId = firstText(comment?.userId);
      const body = firstText(comment?.text, comment?.body);
      if (!commentId || !userId || !eventId || !body) continue;
      const parentId = firstText(comment?.parentId, comment?.parent_id);
      const now = new Date().toISOString();
      const { error } = await params.adminSupabase.from("event_comments").upsert(
        {
          id: commentId,
          event_id: eventId,
          user_id: userId,
          parent_id: parentId && knownCommentIds.has(parentId) ? parentId : null,
          body,
          created_at: firstText(comment?.createdAt) || now,
          updated_at: firstText(comment?.updatedAt, comment?.createdAt) || now,
        },
        {
          onConflict: "id",
        },
      );
      if (!error) stats.eventComments += 1;
    }
  }

  const photoRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photos:",
  });
  for (const row of photoRows) {
    const userId = firstText(row.key.slice("photos:".length));
    const photos = Array.isArray(row.value) ? row.value : [];
    for (const photo of photos) {
      const photoId = firstText(photo?.id);
      const eventId = firstText(photo?.eventId, photo?.event_id, photo?.eventID);
      if (!photoId || !eventId || !userId) continue;
      const images =
        Array.isArray(photo?.images) && photo.images.length > 0
          ? photo.images.map((item: unknown) => firstText(item)).filter(Boolean)
          : firstText(photo?.image)
            ? [firstText(photo?.image)]
            : [];
      if (!images.length) continue;
      const showOnClubProfile = Boolean(photo?.showOnClubProfile ?? photo?.show_on_club_profile);
      const showOnOwnProfile = showOnClubProfile
        ? true
        : Boolean(
            photo?.showOnOwnProfile ??
            photo?.show_on_user_profile ??
            photo?.showOnProfile ??
            photo?.show_on_profile,
          );
      const now = new Date().toISOString();
      const { error } = await params.adminSupabase.from("album_photos").upsert(
        {
          id: photoId,
          event_id: eventId,
          user_id: userId,
          storage_path: images[0],
          media_paths: images,
          caption: firstText(photo?.caption),
          title: firstText(photo?.title) || null,
          show_on_club_profile: showOnClubProfile,
          show_on_profile: showOnOwnProfile || showOnClubProfile,
          show_on_user_profile: showOnOwnProfile,
          created_at: firstText(photo?.createdAt) || now,
          updated_at: firstText(photo?.updatedAt, photo?.createdAt) || now,
        },
        {
          onConflict: "id",
        },
      );
      if (!error) stats.albums += 1;
    }
  }

  const photoLikeRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photolikes:",
  });
  for (const row of photoLikeRows) {
    const photoId = firstText(row.key.slice("photolikes:".length));
    const likes = row.value && typeof row.value === "object" ? row.value : {};
    for (const [userId, liked] of Object.entries(likes)) {
      if (!liked || !photoId || !userId) continue;
      const { error } = await params.adminSupabase.from("album_photo_likes").upsert(
        {
          photo_id: photoId,
          user_id: userId,
        },
        {
          onConflict: "photo_id,user_id",
        },
      );
      if (!error) stats.albumLikes += 1;
    }
  }

  const photoCommentRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "photocomments:",
  });
  for (const row of photoCommentRows) {
    const photoId = firstText(row.key.slice("photocomments:".length));
    const comments = orderCommentsForInsert(Array.isArray(row.value) ? row.value : []);
    const knownCommentIds = new Set(comments.map((item) => firstText(item?.id)).filter(Boolean));
    for (const comment of comments) {
      const commentId = firstText(comment?.id);
      const userId = firstText(comment?.userId);
      const body = firstText(comment?.text, comment?.body);
      if (!commentId || !userId || !photoId || !body) continue;
      const parentId = firstText(comment?.parentId, comment?.parent_id);
      const now = new Date().toISOString();
      const { error } = await params.adminSupabase.from("album_photo_comments").upsert(
        {
          id: commentId,
          photo_id: photoId,
          user_id: userId,
          parent_id: parentId && knownCommentIds.has(parentId) ? parentId : null,
          body,
          created_at: firstText(comment?.createdAt) || now,
          updated_at: firstText(comment?.updatedAt, comment?.createdAt) || now,
        },
        {
          onConflict: "id",
        },
      );
      if (!error) stats.albumComments += 1;
    }
  }

  const notificationRows = await listKvRowsByPrefix({
    adminSupabase: params.adminSupabase,
    kvTable: params.kvTable,
    prefix: "notifications:",
  });
  for (const row of notificationRows) {
    const ownerId = firstText(row.key.slice("notifications:".length));
    const notifications = Array.isArray(row.value) ? row.value : [];
    for (const notification of notifications) {
      const notificationId = firstText(notification?.id);
      if (!notificationId || !ownerId) continue;
      const notificationType = normalizeNotificationType(notification?.type);
      if (!notificationType) continue;
      const { error } = await params.adminSupabase.from("notifications").upsert(
        {
          id: notificationId,
          user_id: ownerId,
          actor_id: firstText(notification?.fromUserId) || null,
          type: notificationType,
          message: firstText(notification?.message) || "Bildirim",
          detail: firstText(notification?.detail) || null,
          event_id: firstText(notification?.eventId) || null,
          target_profile_id: firstText(notification?.targetProfileId) || null,
          is_read: Boolean(notification?.read),
          created_at: firstText(notification?.createdAt) || new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      );
      if (!error) stats.notifications += 1;
    }
  }

  return {
    repaired: true,
    stats,
  };
}
