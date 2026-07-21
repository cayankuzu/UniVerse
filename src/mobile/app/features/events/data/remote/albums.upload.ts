import { post } from "../../../../platform/api/core";
import type { AlbumPhotoWithMeta, UploadPhotoPayload } from "./albums.shared";
import {
  ensureAlbumUploadAllowedForAuthContext,
  ensureServerAlbumInSql,
  finalizeAlbumUpload,
  getAlbumUploadAvailability,
  readAlbumUploadAuthContext,
  refreshAlbumUploadSession,
  writeAlbumPhotoToTable,
} from "./albums.upload.persistence";
import {
  type AlbumUploadAvailability,
  isAlbumWriteAuthError,
  isRecoverableAlbumWriteError,
  MAX_EVENT_ALBUM_CARDS,
  MAX_EVENT_ALBUM_PHOTOS,
  normalizeImages,
} from "./albums.upload.shared";

export { MAX_EVENT_ALBUM_CARDS, MAX_EVENT_ALBUM_PHOTOS, getAlbumUploadAvailability };
export type { AlbumUploadAvailability };

type PersistAlbumUploadOptions = {
  accessTokenHint?: string;
  userIdHint?: string;
};

type RetryableQueueError = Error & {
  retryableQueueError?: boolean;
};

function canFallbackAfterDirectAlbumWrite(error: unknown) {
  return isAlbumWriteAuthError(error) || isRecoverableAlbumWriteError(error);
}

function isAlbumUploadSessionError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "")
    .trim()
    .toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("invalid jwt") ||
    message.includes("auth session missing") ||
    message.includes("oturum") ||
    message.includes("http 401") ||
    message.includes("http 403")
  );
}

function createAlbumUploadSessionRecoveryError() {
  const error = new Error(
    "Oturum doğrulanamadı. Uygulamayı yeniden açıp tekrar dene.",
  ) as RetryableQueueError;
  error.retryableQueueError = true;
  return error;
}

function toAlbumUploadVisibleError(error: unknown) {
  if (isAlbumUploadSessionError(error)) {
    return createAlbumUploadSessionRecoveryError();
  }
  return error instanceof Error ? error : new Error(String(error || "Albüm yüklenemedi."));
}

export async function persistAlbumUpload(
  payload: UploadPhotoPayload,
  options: PersistAlbumUploadOptions = {},
): Promise<AlbumPhotoWithMeta> {
  let authContext = await readAlbumUploadAuthContext({
    accessTokenHint: options.accessTokenHint,
    preferHints: true,
    userIdHint: options.userIdHint,
  }).catch(() => null);
  if (!authContext) {
    throw createAlbumUploadSessionRecoveryError();
  }

  const availability = await ensureAlbumUploadAllowedForAuthContext(payload.eventId, authContext);

  const nextImages = normalizeImages(payload);
  if (!nextImages.length) {
    throw new Error("Medya seçilmedi");
  }
  if (availability.remainingAlbumSlots <= 0) {
    throw new Error("Her kullanıcı bu etkinliğe en fazla 3 albüm kartı ekleyebilir.");
  }

  const nextPayload = {
    ...payload,
    image: nextImages[0],
    images: nextImages,
  };

  let directWriteError: unknown = null;
  try {
    const created = await writeAlbumPhotoToTable({
      client: authContext.client,
      payload: nextPayload,
      userId: authContext.userId,
    });
    return finalizeAlbumUpload(created);
  } catch (error) {
    directWriteError = error;
  }

  if (isAlbumWriteAuthError(directWriteError) && (await refreshAlbumUploadSession())) {
    authContext = await readAlbumUploadAuthContext({
      userIdHint: authContext.userId || options.userIdHint,
    }).catch(() => null);
    try {
      if (!authContext) {
        throw createAlbumUploadSessionRecoveryError();
      }
      const created = await writeAlbumPhotoToTable({
        client: authContext.client,
        payload: nextPayload,
        userId: authContext.userId,
      });
      return finalizeAlbumUpload(created);
    } catch (error) {
      directWriteError = error;
    }
  }

  if (!canFallbackAfterDirectAlbumWrite(directWriteError)) {
    throw toAlbumUploadVisibleError(directWriteError);
  }

  try {
    const created = await post<AlbumPhotoWithMeta>("/albums", nextPayload);
    try {
      if (!authContext) {
        return finalizeAlbumUpload(created);
      }
      const ensured = await ensureServerAlbumInSql({
        client: authContext.client,
        created,
        payload: nextPayload,
        userId: authContext.userId,
      });
      return finalizeAlbumUpload(ensured);
    } catch {
      return finalizeAlbumUpload(created);
    }
  } catch (error) {
    if (!isRecoverableAlbumWriteError(error)) {
      throw toAlbumUploadVisibleError(error);
    }
  }

  try {
    return finalizeAlbumUpload(await post<AlbumPhotoWithMeta>("/albums", nextPayload));
  } catch (error) {
    throw toAlbumUploadVisibleError(error);
  }
}
