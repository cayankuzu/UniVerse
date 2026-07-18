import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { resolveMediaUploadFileInfo } from "../../../shared/media/mediaVideoUtils";

type AlbumUploadMediaKind = "image" | "video";

const ALBUM_UPLOAD_MEDIA_DIRECTORY_SEGMENT = "album-upload-queue-media";
const CONTENT_URI_REGEX = /^content:\/\//i;

function normalizeAlbumUploadMediaText(value: unknown) {
  return String(value || "").trim();
}

function resolveAlbumUploadMediaDirectory() {
  const baseDirectory =
    normalizeAlbumUploadMediaText(documentDirectory) ||
    normalizeAlbumUploadMediaText(cacheDirectory);
  if (!baseDirectory) {
    throw new Error("Secilen medya dosyasi hazirlanamadi. Lutfen yeniden sec.");
  }
  return `${baseDirectory.replace(/\/?$/, "/")}${ALBUM_UPLOAD_MEDIA_DIRECTORY_SEGMENT}/`;
}

function isLegacyAndroidScopedStorageUri(uri: string) {
  const normalized = normalizeAlbumUploadMediaText(uri).toLowerCase();
  return (
    normalized.startsWith("file:///storage/emulated/0/") || normalized.startsWith("file:///sdcard/")
  );
}

export function isAndroidGalleryAlbumMediaUri(uri: string) {
  const normalized = normalizeAlbumUploadMediaText(uri).toLowerCase();
  return (
    isLegacyAndroidScopedStorageUri(uri) ||
    normalized.startsWith("content://media/") ||
    normalized.startsWith("content://com.android.providers.media.documents/") ||
    normalized.startsWith("content://com.google.android.apps.photos.content/") ||
    normalized.startsWith("content://com.miui.gallery.open/")
  );
}

function isPersistedAlbumUploadMediaUri(uri: string) {
  const normalized = normalizeAlbumUploadMediaText(uri);
  if (!normalized) return false;

  try {
    return normalized.startsWith(resolveAlbumUploadMediaDirectory());
  } catch {
    return false;
  }
}

function shouldPersistAlbumUploadMediaUri(uri: string) {
  const normalized = normalizeAlbumUploadMediaText(uri);
  if (!normalized || isPersistedAlbumUploadMediaUri(normalized)) {
    return false;
  }
  return CONTENT_URI_REGEX.test(normalized) || isLegacyAndroidScopedStorageUri(normalized);
}

function buildPersistedAlbumUploadMediaName(
  uri: string,
  kind: AlbumUploadMediaKind,
  index: number,
) {
  const fileInfo = resolveMediaUploadFileInfo(uri, {
    baseName: kind === "video" ? "album-video" : "album-photo",
    kind,
  });
  const normalizedName = normalizeAlbumUploadMediaText(fileInfo.name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `${Date.now().toString(36)}-${index + 1}-${Math.random().toString(36).slice(2, 8)}-${normalizedName || fileInfo.name}`;
}

export function buildAlbumUploadMediaAccessErrorMessage() {
  return "Secilen medya dosyasina Android galerisi uzerinden erisilemiyor. Karti silip medyayi galeriden yeniden sec.";
}

export function getAlbumUploadPayloadImages(payload: Record<string, unknown>) {
  const images = Array.isArray(payload.images)
    ? payload.images.map((item) => normalizeAlbumUploadMediaText(item)).filter(Boolean)
    : [];
  if (images.length > 0) return images;

  const image = normalizeAlbumUploadMediaText(payload.image);
  return image ? [image] : [];
}

function getAlbumUploadPayloadMediaKinds(payload: Record<string, unknown>, imageCount: number) {
  const kinds = Array.isArray(payload.mediaKinds)
    ? payload.mediaKinds
        .map((item) => normalizeAlbumUploadMediaText(item))
        .filter((item): item is AlbumUploadMediaKind => item === "image" || item === "video")
    : [];
  return kinds.slice(0, imageCount);
}

export async function persistAlbumUploadMediaUris(params: {
  images: string[];
  mediaKinds?: AlbumUploadMediaKind[];
}) {
  const normalizedImages = params.images
    .map((imageUri) => normalizeAlbumUploadMediaText(imageUri))
    .filter(Boolean);
  if (!normalizedImages.length) {
    return normalizedImages;
  }

  const persistOperations = normalizedImages
    .map((imageUri, index) => {
      if (!shouldPersistAlbumUploadMediaUri(imageUri)) {
        return null;
      }
      const mediaKind = params.mediaKinds?.[index] === "video" ? "video" : "image";
      return {
        index,
        sourceUri: imageUri,
        targetName: buildPersistedAlbumUploadMediaName(imageUri, mediaKind, index),
      };
    })
    .filter(Boolean) as Array<{
    index: number;
    sourceUri: string;
    targetName: string;
  }>;
  if (!persistOperations.length) {
    return normalizedImages;
  }

  const uploadMediaDirectory = resolveAlbumUploadMediaDirectory();
  await makeDirectoryAsync(uploadMediaDirectory, { intermediates: true }).catch(() => null);
  const copiedByIndex = new Map<number, string>();
  const copiedUris = persistOperations.map(
    (operation) => `${uploadMediaDirectory}${operation.targetName}`,
  );

  try {
    await Promise.all(
      persistOperations.map(async (operation) => {
        const targetUri = `${uploadMediaDirectory}${operation.targetName}`;
        await copyAsync({
          from: operation.sourceUri,
          to: targetUri,
        });
        copiedByIndex.set(operation.index, targetUri);
      }),
    );
  } catch {
    await Promise.all(
      copiedUris.map((uri) => deleteAsync(uri, { idempotent: true }).catch(() => null)),
    );
    throw new Error(buildAlbumUploadMediaAccessErrorMessage());
  }

  return normalizedImages.map((imageUri, index) => copiedByIndex.get(index) || imageUri);
}

export async function stabilizeAlbumUploadPayloadMedia(payload: Record<string, unknown>) {
  const images = getAlbumUploadPayloadImages(payload);
  if (!images.length) {
    return { changed: false, payload };
  }

  const mediaKinds = getAlbumUploadPayloadMediaKinds(payload, images.length);
  const persistedImages = await persistAlbumUploadMediaUris({
    images,
    mediaKinds,
  });
  const changed = persistedImages.some((uri, index) => uri !== images[index]);
  if (!changed) {
    return { changed: false, payload };
  }

  return {
    changed: true,
    payload: {
      ...payload,
      image: persistedImages[0] || "",
      images: persistedImages,
      mediaKinds,
    },
  };
}

export async function cleanupAlbumUploadPayloadMedia(payload: Record<string, unknown>) {
  const persistedImages = getAlbumUploadPayloadImages(payload).filter(
    isPersistedAlbumUploadMediaUri,
  );
  if (!persistedImages.length) {
    return;
  }

  await Promise.all(
    persistedImages.map((uri) => deleteAsync(uri, { idempotent: true }).catch(() => null)),
  );
}
