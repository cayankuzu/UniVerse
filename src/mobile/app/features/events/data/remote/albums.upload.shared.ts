import { normalizeSharedEventAlbumVisibility } from "../../../../data/policies/visibility";
import type { UploadPhotoPayload } from "./albums.shared";

export const MAX_EVENT_ALBUM_PHOTOS = 9;
export const MAX_EVENT_ALBUM_CARDS = 3;

export type AlbumUploadAvailability = {
  canUpload: boolean;
  isOwnerClub: boolean;
  isParticipant: boolean;
  ownAlbumCount: number;
  remainingAlbumSlots: number;
  reason: string | null;
};

export function normalizeImages(payload: UploadPhotoPayload) {
  const images =
    Array.isArray(payload.images) && payload.images.length > 0
      ? payload.images
      : payload.image
        ? [payload.image]
        : [];
  return images.map((item) => String(item || "").trim()).filter(Boolean);
}

export function normalizeProfileSurfaceVisibility(payload: UploadPhotoPayload) {
  return normalizeSharedEventAlbumVisibility(payload);
}

export function getAlbumRowPhotoCount(row: { media_paths?: unknown; storage_path?: unknown }) {
  if (Array.isArray(row.media_paths) && row.media_paths.length > 0) {
    return row.media_paths.map((item) => String(item || "").trim()).filter(Boolean).length;
  }
  return String(row.storage_path || "").trim() ? 1 : 0;
}

export function isRecoverableAlbumWriteError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("abort-timeout") ||
    message.includes("timed out") ||
    message.includes("istek zaman asimina") ||
    message.includes("istek zaman aşımına")
  );
}

export function isAlbumWriteAuthError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  return (
    message.includes("invalid jwt") ||
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("auth session missing")
  );
}

export function createAlbumPhotoId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const raw = Math.floor(Math.random() * 16);
    const value = char === "x" ? raw : (raw & 0x3) | 0x8;
    return value.toString(16);
  });
}
