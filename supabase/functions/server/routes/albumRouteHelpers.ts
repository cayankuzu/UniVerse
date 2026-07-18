import * as kv from "../kv_store.ts";
import type { KvAlbumPhotoRecord } from "../types.ts";

export async function listAllPhotosFromKv() {
  const allUserIds = await kv.get<string[]>("all_users").then((value) => value || []);
  const photoGroups = await Promise.all(
    allUserIds.map((userId) =>
      kv.get<KvAlbumPhotoRecord[]>(`photos:${userId}`).then((value) => value || []),
    ),
  );
  return photoGroups.flat();
}

export function normalizeKvPhotoEventId(photo: KvAlbumPhotoRecord | null | undefined) {
  return String(photo?.eventId || photo?.event_id || "").trim();
}

export function normalizeKvPhotoImages(photo: KvAlbumPhotoRecord | null | undefined) {
  if (Array.isArray(photo?.images) && photo.images.length > 0) {
    return photo.images.map((item: unknown) => String(item || "").trim()).filter(Boolean);
  }
  if (Array.isArray(photo?.media_paths) && photo.media_paths.length > 0) {
    return photo.media_paths.map((item: unknown) => String(item || "").trim()).filter(Boolean);
  }
  return photo?.image
    ? [String(photo.image).trim()].filter(Boolean)
    : photo?.storagePath
      ? [String(photo.storagePath).trim()].filter(Boolean)
      : photo?.storage_path
        ? [String(photo.storage_path).trim()].filter(Boolean)
        : [];
}
