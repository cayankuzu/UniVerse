import type {
  AlbumEventProjectionItem,
  EventDetailProjection,
} from "../../../data/projections/projections.types";
import { normalizeSharedEventAlbumVisibility } from "../../../data/policies/visibility";
import { resolveAlbumSurfaceVisibility } from "../../../data/normalizers/albums";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { logEvent } from "../../../platform/observability";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  enqueueUpload,
  getUploadEntry,
  getUploadQueue,
  patchUploadEntry,
  removeUploadEntry,
  retryUploadEntry,
  type UploadQueueEntry,
} from "../../../data/queues/uploadQueue";
import {
  createAlbumUploadProgress,
  writeUploadProgress,
} from "../../../data/queues/uploadProgress";
import type { AlbumUploadQueueUser } from "./albumUploadQueue.types";
import {
  buildAlbumUploadMediaAccessErrorMessage,
  cleanupAlbumUploadPayloadMedia,
  getAlbumUploadPayloadImages,
  isAndroidGalleryAlbumMediaUri,
} from "./albumUploadQueue.media";

export { processAlbumUploadQueue } from "./albumUploadQueueProcessor";
export type { AlbumUploadQueueUser } from "./albumUploadQueue.types";

export type PendingAlbumPhoto = AlbumEventProjectionItem & {
  uploadError?: string;
  uploadStatus: "failed" | "pending";
};

type AlbumUploadPayload = {
  caption?: string | null;
  clientMutationId: string;
  eventId: string;
  eventTitle: string;
  image: string;
  images: string[];
  mediaKinds?: Array<"image" | "video">;
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnProfile?: boolean;
  title?: string | null;
  authFailureAutoRetriedAt?: string | null;
  uploadedImages?: string[];
  uploaderUserId?: string | null;
};

function normalizeAlbumUploadText(value: unknown) {
  return String(value || "").trim();
}

const ALBUM_UPLOAD_MAX_ATTEMPTS = 24;
const ALBUM_UPLOAD_AUTH_RETRY_PAYLOAD_KEY = "authFailureAutoRetriedAt";

function resolvePendingAlbumUploadError(params: {
  errorMessage?: string;
  payload: Record<string, unknown>;
}) {
  const rawMessage = normalizeAlbumUploadText(params.errorMessage);
  const hasAndroidGalleryFile = getAlbumUploadPayloadImages(params.payload).some(
    isAndroidGalleryAlbumMediaUri,
  );
  if (!hasAndroidGalleryFile) {
    return rawMessage || undefined;
  }

  const normalizedMessage = rawMessage.toLowerCase();
  const isGenericStorageAccessError =
    !normalizedMessage ||
    normalizedMessage === "upload failed." ||
    normalizedMessage === "upload failed" ||
    normalizedMessage === "unauthorized" ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("eacces") ||
    normalizedMessage.includes("file not foundexception") ||
    normalizedMessage.includes("open failed");
  if (isGenericStorageAccessError) {
    return buildAlbumUploadMediaAccessErrorMessage();
  }

  return rawMessage;
}

function isAlbumUploadAuthFailureMessage(message: unknown) {
  const normalized = normalizeAlbumUploadText(message).toLowerCase();
  return (
    normalized.includes("unauthorized") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("auth session missing") ||
    normalized.includes("oturum") ||
    normalized.includes("http 401") ||
    normalized.includes("http 403")
  );
}

function shouldAutoRetryFailedAlbumUpload(entry: UploadQueueEntry) {
  if (entry.status !== "failed") return false;
  if (!isAlbumUploadAuthFailureMessage(entry.errorMessage)) return false;
  if (normalizeAlbumUploadText(entry.payload?.[ALBUM_UPLOAD_AUTH_RETRY_PAYLOAD_KEY])) {
    return false;
  }

  const visibleError = normalizeAlbumUploadText(
    resolvePendingAlbumUploadError({
      errorMessage: entry.errorMessage,
      payload: entry.payload,
    }),
  ).toLowerCase();
  return !visibleError.includes("erisilemiyor") && !visibleError.includes("erişilemiyor");
}

async function recoverRetryableFailedAlbumUploads(entries: UploadQueueEntry[]) {
  let recovered = false;
  const recoveredAt = new Date().toISOString();
  for (const entry of entries) {
    if (!shouldAutoRetryFailedAlbumUpload(entry)) continue;
    await patchUploadEntry(entry.id, {
      attemptCount: 0,
      errorMessage: undefined,
      nextProcessAt: recoveredAt,
      payload: {
        ...entry.payload,
        [ALBUM_UPLOAD_AUTH_RETRY_PAYLOAD_KEY]: recoveredAt,
      },
      status: "pending",
    });
    recovered = true;
  }
  return recovered;
}

export function isPendingPhoto(
  item: AlbumEventProjectionItem | PendingAlbumPhoto,
): item is PendingAlbumPhoto {
  return String(item.id || "").startsWith("temp-album:");
}

export function mapAlbumUploadEntryToPendingPhoto(params: {
  createdAt: string;
  errorMessage?: string;
  event: EventDetailProjection["event"] | null;
  eventId: string;
  payload: Record<string, unknown>;
  status: "failed" | "pending";
  userData: AlbumUploadQueueUser;
  entryId: string;
}): PendingAlbumPhoto {
  const { createdAt, errorMessage, entryId, event, eventId, payload, status, userData } = params;
  const surfaceVisibility = resolveAlbumSurfaceVisibility(
    normalizeSharedEventAlbumVisibility(payload),
  );
  const payloadImages = getAlbumUploadPayloadImages(payload);

  return {
    caption: typeof payload.caption === "string" ? payload.caption : undefined,
    clubUsername: event?.clubUsername,
    comments: 0,
    createdAt,
    eventId,
    eventTitle: normalizeAlbumUploadText(payload.eventTitle || event?.title || "Etkinlik Albümü"),
    id: entryId,
    image: payloadImages[0] || "",
    images: payloadImages,
    liked: false,
    likes: 0,
    name: userData.name || userData.clubName || userData.username || "Kullanıcı",
    photoCount: payloadImages.length || 1,
    showOnClubProfile: surfaceVisibility.showOnClubProfile,
    showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
    showOnProfile: surfaceVisibility.showOnProfile,
    surfaceVisibility,
    title: typeof payload.title === "string" ? payload.title : undefined,
    uploadError: resolvePendingAlbumUploadError({ errorMessage, payload }),
    uploadStatus: status,
    userId: userData.id || userData.username || "",
    userImage: userData.profileImage || "",
    username: userData.username || "",
  };
}

export async function listPendingAlbumPhotos(params: {
  event: EventDetailProjection["event"] | null;
  eventId: string;
  ownerId?: string;
  userData: AlbumUploadQueueUser;
}) {
  let queueEntries = await getUploadQueue("album-photo", params.ownerId);
  const relevantEntries = queueEntries.filter(
    (entry) => String(entry.payload.eventId || "") === params.eventId,
  );
  if (await recoverRetryableFailedAlbumUploads(relevantEntries)) {
    queueEntries = await getUploadQueue("album-photo", params.ownerId);
  }
  return queueEntries
    .filter((entry) => String(entry.payload.eventId || "") === params.eventId)
    .map((entry) =>
      mapAlbumUploadEntryToPendingPhoto({
        createdAt: entry.createdAt,
        errorMessage: entry.errorMessage,
        entryId: entry.id,
        event: params.event,
        eventId: params.eventId,
        payload: entry.payload,
        status: entry.status === "failed" ? "failed" : "pending",
        userData: params.userData,
      }),
    );
}

export function createPendingAlbumUpload(params: {
  caption?: string;
  event: EventDetailProjection["event"] | null;
  eventId: string;
  images: string[];
  mediaKinds?: Array<"image" | "video">;
  title?: string;
  userData: AlbumUploadQueueUser;
  baseTime?: number;
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
}) {
  const surfaceVisibility = resolveAlbumSurfaceVisibility(
    normalizeSharedEventAlbumVisibility(params),
  );
  const normalizedImages = params.images
    .map((imageUri) => normalizeAlbumUploadText(imageUri))
    .filter(Boolean);
  const normalizedMediaKinds = Array.isArray(params.mediaKinds)
    ? params.mediaKinds.slice(0, normalizedImages.length)
    : [];
  const baseTime = params.baseTime ?? Date.now();
  const clientMutationId = createClientMutationId("album-upload");
  const pendingPhoto = mapAlbumUploadEntryToPendingPhoto({
    createdAt: new Date(baseTime).toISOString(),
    entryId: `temp-album:${baseTime}:${Math.random().toString(16).slice(2)}`,
    event: params.event,
    eventId: params.eventId,
    payload: {
      caption: params.caption || null,
      clientMutationId,
      eventId: params.eventId,
      eventTitle: params.event?.title || "Etkinlik Albumu",
      image: normalizedImages[0] || "",
      images: normalizedImages,
      mediaKinds: normalizedMediaKinds,
      showOnClubProfile: surfaceVisibility.showOnClubProfile,
      showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
      showOnProfile: surfaceVisibility.showOnProfile,
      title: params.title || null,
      uploaderUserId: params.userData.id || null,
    } satisfies AlbumUploadPayload,
    status: "pending",
    userData: params.userData,
  });

  return {
    payload: {
      caption: pendingPhoto.caption || null,
      clientMutationId,
      eventId: params.eventId,
      eventTitle: pendingPhoto.eventTitle,
      image: pendingPhoto.image,
      images: normalizedImages,
      mediaKinds: normalizedMediaKinds,
      showOnClubProfile: surfaceVisibility.showOnClubProfile,
      showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
      showOnProfile: surfaceVisibility.showOnProfile,
      title: pendingPhoto.title || null,
      uploaderUserId: params.userData.id || null,
    } satisfies AlbumUploadPayload,
    pendingPhoto,
  };
}

export async function enqueuePendingAlbumUpload(params: {
  eventId: string;
  imageCount: number;
  ownerId?: string;
  payload: AlbumUploadPayload;
  viewerKey: string;
  entryId: string;
}) {
  const payload = writeUploadProgress(params.payload, createAlbumUploadProgress(params.eventId));
  await enqueueUpload({
    id: params.entryId,
    kind: "album-photo",
    maxAttempts: ALBUM_UPLOAD_MAX_ATTEMPTS,
    ownerId: params.ownerId,
    payload,
  });
  logEvent({
    category: "upload",
    meta: { eventId: params.eventId, imageCount: params.imageCount, kind: "album-photo" },
    name: "album-photo-queued",
    screenKey: projectionKeys.albumEvent(params.eventId, params.viewerKey).join(":"),
    status: "ok",
  });
}

export async function removePendingAlbumUpload(entryId: string) {
  const entry = await getUploadEntry(entryId);
  if (entry?.kind === "album-photo") {
    await cleanupAlbumUploadPayloadMedia(entry.payload).catch(() => null);
  }
  await removeUploadEntry(entryId);
}

export function retryPendingAlbumUpload(entryId: string) {
  return retryUploadEntry(entryId);
}
