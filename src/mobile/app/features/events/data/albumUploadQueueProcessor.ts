import type { QueryClient } from "@tanstack/react-query";
import {
  getUploadEntry,
  patchUploadEntry,
  processUploadQueue,
  type UploadQueueEntry,
} from "../../../data/queues/uploadQueue";
import { writeUploadProgress } from "../../../data/queues/uploadProgress";
import { normalizeSharedEventAlbumVisibility } from "../../../data/policies/visibility";
import { isStorageRemoteError } from "../../../data/storage/storage.helpers.shared";
import { StorageAPI } from "../../../data/storage/storage";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import { recoverAuthState } from "../../../platform/supabase/authSession";
import { patchAlbumUploadCaches } from "./albumUploadQueueCache";
import { uploadPendingAlbumMedia } from "./albumUploadQueueProcessor.media";
import {
  buildAlbumUploadMediaAccessErrorMessage,
  cleanupAlbumUploadPayloadMedia,
  getAlbumUploadPayloadImages,
  isAndroidGalleryAlbumMediaUri,
  stabilizeAlbumUploadPayloadMedia,
} from "./albumUploadQueue.media";
import type { AlbumUploadQueueUser } from "./albumUploadQueue.types";
import { AlbumAPI } from "./remote/albums.api";

function normalizeAlbumUploadProcessText(value: unknown) {
  return String(value || "").trim();
}

type RetryableAlbumUploadQueueError = Error & {
  retryableQueueError?: boolean;
};

type CancelledAlbumUploadQueueError = Error & {
  cancelledAlbumUpload?: boolean;
  cleanupPayload?: Record<string, unknown>;
};

const ALBUM_AUTH_TIMEOUT_MS = 8_000;
const ALBUM_IMAGE_UPLOAD_TIMEOUT_MS = 25_000;
const ALBUM_VIDEO_UPLOAD_TIMEOUT_MS = 300_000;
const ALBUM_CREATE_TIMEOUT_MS = 15_000;

function nowMs() {
  return Date.now();
}

function logAlbumUploadStep(entryId: string, step: string, payload?: Record<string, unknown>) {
  debugLog("MEDIA/ALBUM_UPLOAD", step, {
    entryId,
    ...payload,
  });
}

function logAlbumUploadError(entryId: string, step: string, error: unknown) {
  debugWarn("MEDIA/ALBUM_UPLOAD", step, {
    entryId,
    message: normalizeAlbumUploadProcessText(
      (error as { message?: string } | null)?.message || error,
    ),
  });
}

function createAlbumUploadAuthRecoveryError() {
  const error = new Error(
    "Oturum yenileniyor. Album yukleme birazdan otomatik tekrar denenecek.",
  ) as RetryableAlbumUploadQueueError;
  error.retryableQueueError = true;
  return error;
}

function createAlbumUploadCancelledError(payload?: Record<string, unknown>) {
  const error = new Error("Album upload cancelled.") as CancelledAlbumUploadQueueError;
  error.cancelledAlbumUpload = true;
  error.cleanupPayload = payload;
  return error;
}

function isAlbumUploadCancelledError(error: unknown): error is CancelledAlbumUploadQueueError {
  return (error as CancelledAlbumUploadQueueError | null)?.cancelledAlbumUpload === true;
}

function createRetryableAlbumUploadTimeoutError(label: string) {
  const error = new Error(`${label} timeout.`) as RetryableAlbumUploadQueueError;
  error.retryableQueueError = true;
  return error;
}

function withAlbumUploadStepTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        reject(createRetryableAlbumUploadTimeoutError(label));
      },
      Math.max(1, timeoutMs),
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeUploadToken(value: unknown, fallback: string) {
  const normalized = normalizeAlbumUploadProcessText(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return normalized || fallback;
}

async function resolveAlbumUploadAuthHints(params: {
  ownerId?: string;
  payload?: Record<string, unknown>;
  userData: AlbumUploadQueueUser;
}) {
  const authState = await recoverAuthState().catch(() => null);
  const accessTokenHint = normalizeAlbumUploadProcessText(authState?.accessToken);
  const userIdHint = normalizeAlbumUploadProcessText(
    authState?.user?.id || params.payload?.uploaderUserId || params.userData.id || params.ownerId,
  );

  return {
    accessTokenHint: accessTokenHint || undefined,
    userIdHint: userIdHint || undefined,
  };
}

function getCheckpointedAlbumUploads(payload: Record<string, unknown>, imageCount: number) {
  if (!Array.isArray(payload.uploadedImages)) return [];
  return payload.uploadedImages
    .slice(0, imageCount)
    .map((item) => normalizeAlbumUploadProcessText(item));
}

function isUploadedAlbumStoragePath(value: string) {
  const normalized = normalizeAlbumUploadProcessText(value).toLowerCase();
  return normalized.startsWith("albums/") && !normalized.startsWith("file:");
}

function toAlbumUploadSourceError(error: unknown, sourceUri: string) {
  const rawMessage = normalizeAlbumUploadProcessText(
    (error as { message?: string } | null)?.message || error,
  );
  const normalizedMessage = rawMessage.toLowerCase();
  if (
    !isStorageRemoteError(error) &&
    isAndroidGalleryAlbumMediaUri(sourceUri) &&
    (!normalizedMessage ||
      normalizedMessage === "upload failed." ||
      normalizedMessage === "upload failed" ||
      normalizedMessage === "unauthorized" ||
      normalizedMessage.includes("unauthorized") ||
      normalizedMessage.includes("permission denied") ||
      normalizedMessage.includes("eacces") ||
      normalizedMessage.includes("file not foundexception") ||
      normalizedMessage.includes("open failed"))
  ) {
    return new Error(buildAlbumUploadMediaAccessErrorMessage());
  }
  return error instanceof Error ? error : new Error(rawMessage || "Album yuklenemedi.");
}

function getAlbumMediaUploadTimeoutMs(mediaKind: "image" | "video" | undefined) {
  return mediaKind === "video" ? ALBUM_VIDEO_UPLOAD_TIMEOUT_MS : ALBUM_IMAGE_UPLOAD_TIMEOUT_MS;
}

async function patchAlbumUploadProgress(params: {
  entryId: string;
  payload: Record<string, unknown>;
  percent: number;
  stage: string;
}) {
  const nextPayload = writeUploadProgress(params.payload, {
    hint: "Uygulamayi kullanmaya devam edebilirsin; kapanirsa sonraki acilista surer.",
    percent: params.percent,
    stage: params.stage,
    title: "Album karti paylasiliyor",
  });
  const patchedEntry = await patchUploadEntry(params.entryId, {
    payload: nextPayload,
    status: "uploading",
  });
  if (!patchedEntry) {
    throw createAlbumUploadCancelledError(nextPayload);
  }
  return patchedEntry.payload;
}

async function assertAlbumUploadEntryActive(entryId: string, payload?: Record<string, unknown>) {
  const liveEntry = await getUploadEntry(entryId).catch(() => null);
  if (!liveEntry) {
    throw createAlbumUploadCancelledError(payload);
  }
  return liveEntry;
}

async function createAlbumFromUploadEntry(
  entry: UploadQueueEntry,
  authHints: {
    accessTokenHint?: string;
    userIdHint?: string;
  },
) {
  const startedAt = nowMs();
  logAlbumUploadStep(entry.id, "entry:start");
  await assertAlbumUploadEntryActive(entry.id, entry.payload);
  const stabilizedPayloadResult = await stabilizeAlbumUploadPayloadMedia(entry.payload);
  let payload = stabilizedPayloadResult.payload;
  if (stabilizedPayloadResult.changed) {
    const patchedEntry = await patchUploadEntry(entry.id, {
      payload,
      status: "uploading",
    });
    if (!patchedEntry) {
      throw createAlbumUploadCancelledError(payload);
    }
  }
  await assertAlbumUploadEntryActive(entry.id, payload);
  payload = await patchAlbumUploadProgress({
    entryId: entry.id,
    payload,
    percent: 14,
    stage: "Medyalar hazirlaniyor",
  });

  const eventId = String(payload.eventId || "").trim();
  const images = getAlbumUploadPayloadImages(payload);
  const mediaKinds = Array.isArray(payload.mediaKinds)
    ? (payload.mediaKinds.map((item) => String(item || "").trim()).filter(Boolean) as Array<
        "image" | "video"
      >)
    : [];

  if (!eventId) throw new Error("Album etkinlik bilgisi eksik.");
  if (!images.length) throw new Error("Album medyasi bulunamadi.");

  const visibility = normalizeSharedEventAlbumVisibility(payload);
  const uploadSeed = normalizeUploadToken(
    payload.clientMutationId,
    normalizeUploadToken(entry.id, "album-upload"),
  );
  let uploadedUrls = getCheckpointedAlbumUploads(payload, images.length);
  const persistedUploadSessionId = normalizeAlbumUploadProcessText(payload.uploadSessionId);
  if (!persistedUploadSessionId && uploadedUrls.some(isUploadedAlbumStoragePath)) {
    // Checkpoints created before verified sessions existed cannot be published
    // safely. Re-upload them through the fail-closed session state machine.
    uploadedUrls = images.map(() => "");
    payload = {
      ...payload,
      uploadedImages: uploadedUrls,
    };
  }
  const pendingUploads = images
    .map((sourceUri, index) => ({
      index,
      mediaKind: mediaKinds[index],
      sourceUri,
    }))
    .filter(({ index }) => !isUploadedAlbumStoragePath(uploadedUrls[index]));
  if (pendingUploads.length > 0) {
    payload = await patchAlbumUploadProgress({
      entryId: entry.id,
      payload,
      percent: 14,
      stage: `Medyalar hazirlaniyor (0/${pendingUploads.length})`,
    });
    payload = await uploadPendingAlbumMedia({
      assertActive: (nextPayload) => assertAlbumUploadEntryActive(entry.id, nextPayload),
      authHints,
      entryId: entry.id,
      getTimeoutMs: getAlbumMediaUploadTimeoutMs,
      images,
      logError: (step, error) => logAlbumUploadError(entry.id, step, error),
      logStep: (step, meta) => logAlbumUploadStep(entry.id, step, meta),
      patchProgress: (progress) =>
        patchAlbumUploadProgress({
          entryId: entry.id,
          ...progress,
        }),
      payload,
      pendingUploads,
      toSourceError: toAlbumUploadSourceError,
      uploadedUrls,
      uploadSeed,
    });
    payload = {
      ...payload,
      uploadedImages: images.map((_image, uploadIndex) => uploadedUrls[uploadIndex] || ""),
    };
    payload = await patchAlbumUploadProgress({
      entryId: entry.id,
      payload,
      percent: 82,
      stage: "Yayin paketi hazirlaniyor",
    });
  }

  const albumImages = images.map((_image, index) => uploadedUrls[index]).filter(Boolean);
  if (albumImages.length !== images.length) {
    throw new Error("Album medyasi yuklenemedi.");
  }

  const albumAuthHints = authHints.accessTokenHint
    ? authHints
    : await resolveAlbumUploadAuthHints({
        payload,
        userData: {
          id: authHints.userIdHint,
        } as AlbumUploadQueueUser,
      });
  if (!albumAuthHints.accessTokenHint) {
    throw createAlbumUploadAuthRecoveryError();
  }

  await assertAlbumUploadEntryActive(entry.id, payload);
  const createStartedAt = nowMs();
  payload = await patchAlbumUploadProgress({
    entryId: entry.id,
    payload,
    percent: 90,
    stage: "Album karti yayinlaniyor",
  });
  logAlbumUploadStep(entry.id, "create:start", {
    imageCount: albumImages.length,
  });
  const createdAlbum = await withAlbumUploadStepTimeout(
    AlbumAPI.uploadPhoto(
      {
        caption: typeof payload.caption === "string" ? payload.caption : undefined,
        clientMutationId: String(payload.clientMutationId || "").trim() || undefined,
        eventId,
        eventTitle: String(payload.eventTitle || "Etkinlik Albumu"),
        image: albumImages[0],
        images: albumImages,
        showOnClubProfile: visibility.showOnClubProfile,
        showOnOwnProfile: visibility.showOnOwnProfile,
        showOnProfile: visibility.showOnProfile,
        title: typeof payload.title === "string" ? payload.title : undefined,
      },
      {
        accessTokenHint: albumAuthHints.accessTokenHint,
        userIdHint: albumAuthHints.userIdHint,
      },
    ),
    ALBUM_CREATE_TIMEOUT_MS,
    "Album create",
  );
  const uploadSessionId = normalizeAlbumUploadProcessText(payload.uploadSessionId);
  if (!uploadSessionId) throw new Error("Album upload session bulunamadi.");
  await StorageAPI.finalizeUploadSession(uploadSessionId, albumAuthHints.accessTokenHint);
  logAlbumUploadStep(entry.id, "create:done", {
    durationMs: nowMs() - createStartedAt,
    totalDurationMs: nowMs() - startedAt,
  });
  payload = await patchAlbumUploadProgress({
    entryId: entry.id,
    payload,
    percent: 97,
    stage: "Album karti gonderiye ekleniyor",
  });

  return {
    createdAlbum,
    payload,
  };
}

export async function processAlbumUploadQueue(params: {
  accountType: "club" | "student";
  entryId?: string;
  eventId?: string;
  ownerId?: string;
  queryClient: QueryClient;
  userData: AlbumUploadQueueUser;
  viewerKey: string;
}) {
  await processUploadQueue({
    entryId: params.entryId,
    kind: "album-photo",
    ownerId: params.ownerId,
    shouldProcess: (entry) => {
      if (!params.eventId) return true;
      return String(entry.payload.eventId || "") === params.eventId;
    },
    handler: async (entry) => {
      try {
        const authStartedAt = nowMs();
        logAlbumUploadStep(entry.id, "auth:start");
        await patchAlbumUploadProgress({
          entryId: entry.id,
          payload: entry.payload,
          percent: 8,
          stage: "Oturum dogrulaniyor",
        });
        const authHints = await withAlbumUploadStepTimeout(
          resolveAlbumUploadAuthHints({
            ownerId: params.ownerId,
            payload: entry.payload,
            userData: params.userData,
          }),
          ALBUM_AUTH_TIMEOUT_MS,
          "Album auth",
        );
        logAlbumUploadStep(entry.id, "auth:done", {
          durationMs: nowMs() - authStartedAt,
          hasToken: Boolean(authHints.accessTokenHint),
        });
        const { createdAlbum, payload } = await createAlbumFromUploadEntry(entry, authHints);
        patchAlbumUploadCaches({
          accountType: params.accountType,
          album: createdAlbum,
          queryClient: params.queryClient,
          userData: params.userData,
          viewerKey: params.viewerKey,
        });
        await patchAlbumUploadProgress({
          entryId: entry.id,
          payload,
          percent: 100,
          stage: "Paylasim tamamlandi",
        });
        logAlbumUploadStep(entry.id, "entry:done");
        return payload;
      } catch (error) {
        if (isAlbumUploadCancelledError(error)) {
          logAlbumUploadStep(entry.id, "entry:cancelled");
          return error.cleanupPayload || entry.payload;
        }
        logAlbumUploadError(entry.id, "entry:error", error);
        throw error;
      }
    },
    onResolved: async (_entry, payload) => {
      void cleanupAlbumUploadPayloadMedia(payload).catch(() => null);
    },
  });
}
