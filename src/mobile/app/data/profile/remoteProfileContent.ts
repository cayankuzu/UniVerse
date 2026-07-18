import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";

function normalizeUsername(username: string) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

export async function fetchRemoteProfileEvents(username: string): Promise<EventWithMeta[]> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return [];
  return [];
}

export async function fetchRemoteProfileAlbums(username: string): Promise<AlbumPhotoWithMeta[]> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return [];
  return [];
}
