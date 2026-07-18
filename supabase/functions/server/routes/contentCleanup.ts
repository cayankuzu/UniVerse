import * as kv from "../kv_store.ts";
import type { KvAlbumPhotoRecord, KvCommentRecord, KvNotificationRecord } from "../types.ts";

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizePhotoEventId(photo: KvAlbumPhotoRecord) {
  return normalizeId(photo.eventId || photo.event_id);
}

export function stripCommentCascade(comments: KvCommentRecord[], rootCommentId: string) {
  const rootId = normalizeId(rootCommentId);
  if (!rootId) {
    return {
      nextComments: Array.isArray(comments) ? comments : [],
      removedIds: [] as string[],
    };
  }

  const pending = [rootId];
  const removedIds = new Set<string>();
  const allComments = Array.isArray(comments) ? comments : [];

  while (pending.length > 0) {
    const currentId = pending.pop() || "";
    if (!currentId || removedIds.has(currentId)) continue;
    removedIds.add(currentId);

    allComments.forEach((item) => {
      const parentId = normalizeId(item.parentId);
      const childId = normalizeId(item.id);
      if (parentId === currentId && childId && !removedIds.has(childId)) {
        pending.push(childId);
      }
    });
  }

  return {
    nextComments: allComments.filter((item) => !removedIds.has(normalizeId(item.id))),
    removedIds: Array.from(removedIds),
  };
}

export async function removePhotoFromKv(photoId: string) {
  const normalizedPhotoId = normalizeId(photoId);
  if (!normalizedPhotoId) return;

  const allUsers = await kv.get<string[]>("all_users").then((value) => value || []);
  for (const userId of allUsers) {
    const photos = await kv
      .get<KvAlbumPhotoRecord[]>(`photos:${userId}`)
      .then((value) => value || []);
    if (!photos.length) continue;
    const nextPhotos = photos.filter((photo) => normalizeId(photo.id) !== normalizedPhotoId);
    if (nextPhotos.length !== photos.length) {
      await kv.set(`photos:${userId}`, nextPhotos);
    }
  }

  await kv.del(`photolikes:${normalizedPhotoId}`);
  await kv.del(`photocomments:${normalizedPhotoId}`);
}

export async function removeEventFromKv(eventId: string, clubUsername?: string) {
  const normalizedEventId = normalizeId(eventId);
  if (!normalizedEventId) return;

  const allEvents = await kv.get<string[]>("all_events").then((value) => value || []);
  if (allEvents.length > 0) {
    const nextAllEvents = allEvents.filter((item) => normalizeId(item) !== normalizedEventId);
    if (nextAllEvents.length !== allEvents.length) {
      await kv.set("all_events", nextAllEvents);
    }
  }

  const normalizedClubUsername = String(clubUsername || "")
    .trim()
    .toLowerCase();
  if (normalizedClubUsername) {
    const clubEvents = await kv
      .get<string[]>(`clubevents:${normalizedClubUsername}`)
      .then((value) => value || []);
    if (clubEvents.length > 0) {
      const nextClubEvents = clubEvents.filter((item) => normalizeId(item) !== normalizedEventId);
      if (nextClubEvents.length !== clubEvents.length) {
        await kv.set(`clubevents:${normalizedClubUsername}`, nextClubEvents);
      }
    }
  }

  const allUsers = await kv.get<string[]>("all_users").then((value) => value || []);
  for (const userId of allUsers) {
    const photos = await kv
      .get<KvAlbumPhotoRecord[]>(`photos:${userId}`)
      .then((value) => value || []);
    if (!photos.length) continue;
    const nextPhotos = photos.map((photo) => {
      if (normalizePhotoEventId(photo) !== normalizedEventId) return photo;
      return {
        ...photo,
        eventId: "",
        event_id: "",
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
      };
    });
    const changed = nextPhotos.some((photo, index) => photo !== photos[index]);
    if (changed) {
      await kv.set(`photos:${userId}`, nextPhotos);
    }
  }

  await kv.del(`event:${normalizedEventId}`);
  await kv.del(`eventlikes:${normalizedEventId}`);
  await kv.del(`eventattendees:${normalizedEventId}`);
  await kv.del(`eventcomments:${normalizedEventId}`);
}

export async function sweepNotificationsByTarget(target: { eventId?: string; photoId?: string }) {
  const eventId = normalizeId(target.eventId);
  const photoId = normalizeId(target.photoId);
  if (!eventId && !photoId) return;

  const allUsers = await kv.get<string[]>("all_users").then((value) => value || []);
  for (const userId of allUsers) {
    const notifications = await kv
      .get<KvNotificationRecord[]>(`notifications:${userId}`)
      .then((value) => value || []);
    if (!notifications.length) continue;
    const nextNotifications = notifications.filter((item) => {
      if (photoId && normalizeId(item.photoId) === photoId) return false;
      if (eventId && normalizeId(item.eventId) === eventId) return false;
      return true;
    });
    if (nextNotifications.length !== notifications.length) {
      await kv.set(`notifications:${userId}`, nextNotifications);
    }
  }
}
