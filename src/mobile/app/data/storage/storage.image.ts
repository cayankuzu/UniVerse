import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import { Image, Platform } from "react-native";
import type { StorageFolder, StorageUploadFile } from "../../platform/api/contracts";
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  TARGET_1080P_MEDIA_LONG_EDGE_PX,
  TARGET_1080P_MEDIA_SHORT_EDGE_PX,
  TARGET_1080P_AUDIO_BITRATE_BPS,
  TARGET_1080P_VIDEO_BITRATE_BPS,
  TARGET_1080P_VIDEO_HEIGHT_PX,
  TARGET_1080P_VIDEO_WIDTH_PX,
  buildVideoDurationLimitMessage,
  buildVideoNormalizationFailureMessage,
  buildVideoSizeLimitMessage,
} from "../../shared/media/mediaVideoUtils";
import { normalizeVideoTo1080pUpload } from "../../shared/media/nativeVideoNormalizer";

type StorageImageConstraints = {
  absoluteMaxSourceBytes: number;
  compress: number;
  maxLongEdge: number;
  maxShortEdge: number;
  preferredMaxBytes: number;
};

const FILE_URI_REGEX = /^file:\/\//i;
const CONTENT_URI_REGEX = /^content:\/\//i;
const DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const STORAGE_NORMALIZE_CACHE_SEGMENT = "storage-normalize-cache";
const VIDEO_FILE_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".3gp", ".avi", ".mkv"];

const STORAGE_IMAGE_CONSTRAINTS: Record<StorageFolder, StorageImageConstraints> = {
  albums: {
    absoluteMaxSourceBytes: DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES,
    compress: 0.7,
    maxLongEdge: TARGET_1080P_MEDIA_LONG_EDGE_PX,
    maxShortEdge: TARGET_1080P_MEDIA_SHORT_EDGE_PX,
    preferredMaxBytes: 1536 * 1024,
  },
  avatars: {
    absoluteMaxSourceBytes: DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES,
    compress: 0.74,
    maxLongEdge: TARGET_1080P_MEDIA_LONG_EDGE_PX,
    maxShortEdge: TARGET_1080P_MEDIA_SHORT_EDGE_PX,
    preferredMaxBytes: 768 * 1024,
  },
  covers: {
    absoluteMaxSourceBytes: DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES,
    compress: 0.7,
    maxLongEdge: TARGET_1080P_MEDIA_LONG_EDGE_PX,
    maxShortEdge: TARGET_1080P_MEDIA_SHORT_EDGE_PX,
    preferredMaxBytes: 1536 * 1024,
  },
  events: {
    absoluteMaxSourceBytes: DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES,
    compress: 0.7,
    maxLongEdge: TARGET_1080P_MEDIA_LONG_EDGE_PX,
    maxShortEdge: TARGET_1080P_MEDIA_SHORT_EDGE_PX,
    preferredMaxBytes: 1536 * 1024,
  },
  profiles: {
    absoluteMaxSourceBytes: DEFAULT_ABSOLUTE_MAX_SOURCE_BYTES,
    compress: 0.72,
    maxLongEdge: TARGET_1080P_MEDIA_LONG_EDGE_PX,
    maxShortEdge: TARGET_1080P_MEDIA_SHORT_EDGE_PX,
    preferredMaxBytes: 960 * 1024,
  },
};

function normalizeStorageText(value: unknown) {
  return String(value || "").trim();
}

function inferPreferredSaveFormat(folder: StorageFolder, file: StorageUploadFile) {
  const normalizedName = normalizeStorageText(file.name).toLowerCase();
  const normalizedType = normalizeStorageText(file.type).toLowerCase();
  if (folder === "avatars" && (normalizedType.includes("png") || normalizedName.endsWith(".png"))) {
    return SaveFormat.PNG;
  }
  return SaveFormat.WEBP;
}

export function isVideoUploadFile(file: StorageUploadFile) {
  const normalizedName = normalizeStorageText(file.name).toLowerCase();
  const normalizedType = normalizeStorageText(file.type).toLowerCase();
  return (
    normalizedType.startsWith("video/") ||
    VIDEO_FILE_EXTENSIONS.some((extension) => normalizedName.endsWith(extension))
  );
}

function resolveMimeType(format: SaveFormat) {
  if (format === SaveFormat.PNG) return "image/png";
  if (format === SaveFormat.WEBP) return "image/webp";
  return "image/jpeg";
}

function resolveFileExtension(format: SaveFormat) {
  if (format === SaveFormat.PNG) return "png";
  if (format === SaveFormat.WEBP) return "webp";
  return "jpg";
}

function replaceFileExtension(name: string | undefined, format: SaveFormat) {
  const normalizedName = normalizeStorageText(name) || `upload-${Date.now()}.jpg`;
  const nextExtension = resolveFileExtension(format);
  const withoutExtension = normalizedName.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "upload"}-${Date.now().toString(36)}.${nextExtension}`;
}

function replaceVideoFileExtension(name: string | undefined) {
  const normalizedName = normalizeStorageText(name) || `upload-${Date.now()}.mp4`;
  const withoutExtension = normalizedName.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "upload"}-${Date.now().toString(36)}.mp4`;
}

function buildNormalizedVideoCacheUri(sourceUri: string) {
  if (!FILE_URI_REGEX.test(sourceUri)) return "";
  const normalizedUri = normalizeStorageText(sourceUri).split("?")[0] || "";
  if (!normalizedUri) return "";
  if (normalizedUri.toLowerCase().endsWith("-normalized.mp4")) return normalizedUri;
  if (/\.[^/.]+$/.test(normalizedUri)) {
    return normalizedUri.replace(/\.[^/.]+$/, "-normalized.mp4");
  }
  return `${normalizedUri}-normalized.mp4`;
}

async function readCachedNormalizedVideo(sourceUri: string) {
  const cachedUri = buildNormalizedVideoCacheUri(sourceUri);
  if (!cachedUri || cachedUri === sourceUri) return null;

  const cachedInfo = await getInfoAsync(cachedUri).catch(() => null);
  if (!cachedInfo?.exists || cachedInfo.isDirectory) return null;

  const cachedSizeBytes = "size" in cachedInfo ? Number(cachedInfo.size || 0) : 0;
  if (!cachedSizeBytes || cachedSizeBytes > MAX_VIDEO_UPLOAD_BYTES) {
    await deleteAsync(cachedUri, { idempotent: true }).catch(() => null);
    return null;
  }

  return {
    mimeType: "video/mp4",
    sizeBytes: cachedSizeBytes,
    uri: cachedUri,
  };
}

async function persistNormalizedVideoCache(params: { normalizedUri: string; sourceUri: string }) {
  const cachedUri = buildNormalizedVideoCacheUri(params.sourceUri);
  const normalizedUri = normalizeStorageText(params.normalizedUri);
  if (!cachedUri || !normalizedUri || cachedUri === normalizedUri) {
    return normalizedUri;
  }

  await deleteAsync(cachedUri, { idempotent: true }).catch(() => null);
  await copyAsync({
    from: normalizedUri,
    to: cachedUri,
  });
  return cachedUri;
}

function readImageDimensions(uri: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ height, width }), reject);
  });
}

function resolveResizeTarget(
  dimensions: { height: number; width: number },
  constraints: StorageImageConstraints,
) {
  const width = Math.max(1, Math.round(dimensions.width));
  const height = Math.max(1, Math.round(dimensions.height));
  const isLandscape = width >= height;
  const maxWidth = isLandscape ? constraints.maxLongEdge : constraints.maxShortEdge;
  const maxHeight = isLandscape ? constraints.maxShortEdge : constraints.maxLongEdge;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  if (scale >= 1) return null;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

async function prepareLocalNormalizeUri(sourceUri: string) {
  if (FILE_URI_REGEX.test(sourceUri)) {
    return {
      cleanup: async () => undefined,
      localUri: sourceUri,
    };
  }
  if (!CONTENT_URI_REGEX.test(sourceUri)) {
    return null;
  }

  const baseCacheDirectory = normalizeStorageText(cacheDirectory);
  if (!baseCacheDirectory) {
    throw new Error("Fotoğraf hazırlanamadı.");
  }
  const tempDirectory = `${baseCacheDirectory.replace(/\/?$/, "/")}${STORAGE_NORMALIZE_CACHE_SEGMENT}/`;
  await makeDirectoryAsync(tempDirectory, { intermediates: true }).catch(() => null);
  const localUri = `${tempDirectory}normalize-${Date.now().toString(36)}.jpg`;
  await copyAsync({
    from: sourceUri,
    to: localUri,
  });
  return {
    cleanup: async () => {
      await deleteAsync(localUri, { idempotent: true }).catch(() => null);
    },
    localUri,
  };
}

async function manipulateWithFormatFallback(params: {
  compress: number;
  format: SaveFormat;
  resizeTarget: { height: number; width: number } | null;
  sourceUri: string;
}) {
  const actions = params.resizeTarget ? [{ resize: params.resizeTarget }] : [];
  try {
    return {
      format: params.format,
      result: await manipulateAsync(params.sourceUri, actions, {
        compress: params.compress,
        format: params.format,
      }),
    };
  } catch (error) {
    if (params.format !== SaveFormat.WEBP) {
      throw error;
    }
    return {
      format: SaveFormat.JPEG,
      result: await manipulateAsync(params.sourceUri, actions, {
        compress: params.compress,
        format: SaveFormat.JPEG,
      }),
    };
  }
}

export async function normalizeStorageUploadFile(
  file: StorageUploadFile,
  folder: StorageFolder,
): Promise<StorageUploadFile> {
  const normalizedUri = normalizeStorageText(file.uri);
  if (!normalizedUri) {
    throw new Error("Dosya secilmedi.");
  }

  if (isVideoUploadFile(file)) {
    const normalizedBaseName = normalizeStorageText(file.name).replace(/\.[^.]+$/, "") || "upload";
    const requiresNative1080pNormalization =
      Platform.OS === "android" &&
      (FILE_URI_REGEX.test(normalizedUri) || CONTENT_URI_REGEX.test(normalizedUri));
    const cachedVideo = await readCachedNormalizedVideo(normalizedUri);
    if (cachedVideo) {
      return {
        name: replaceVideoFileExtension(file.name),
        type: cachedVideo.mimeType,
        uri: cachedVideo.uri,
      };
    }

    let normalizedVideo: Awaited<ReturnType<typeof normalizeVideoTo1080pUpload>> = null;
    try {
      normalizedVideo = await normalizeVideoTo1080pUpload({
        audioBitrateBps: TARGET_1080P_AUDIO_BITRATE_BPS,
        baseName: normalizedBaseName,
        maxBytes: MAX_VIDEO_UPLOAD_BYTES,
        maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
        sourceUri: normalizedUri,
        targetLongEdgePx: TARGET_1080P_VIDEO_WIDTH_PX,
        targetShortEdgePx: TARGET_1080P_VIDEO_HEIGHT_PX,
        videoBitrateBps: TARGET_1080P_VIDEO_BITRATE_BPS,
      });
    } catch (error) {
      const message = normalizeStorageText((error as { message?: string } | null)?.message);
      if (message) {
        throw error instanceof Error ? error : new Error(message);
      }
      throw new Error(buildVideoNormalizationFailureMessage());
    }
    const normalizedVideoUri = normalizeStorageText(normalizedVideo?.uri);
    if (requiresNative1080pNormalization && !normalizedVideoUri) {
      throw new Error(buildVideoNormalizationFailureMessage());
    }
    const resolvedVideoUri = normalizedVideoUri
      ? await persistNormalizedVideoCache({
          normalizedUri: normalizedVideoUri,
          sourceUri: normalizedUri,
        }).catch(() => normalizedVideoUri)
      : normalizedUri;
    const resolvedVideoDurationMs = Number(normalizedVideo?.durationMs || 0);
    if (
      Number.isFinite(resolvedVideoDurationMs) &&
      resolvedVideoDurationMs > MAX_VIDEO_DURATION_SECONDS * 1000
    ) {
      throw new Error(buildVideoDurationLimitMessage());
    }

    const info = await getInfoAsync(resolvedVideoUri).catch(() => null);
    const resolvedInfoSizeBytes =
      info?.exists && !info.isDirectory && "size" in info ? Number(info.size || 0) : 0;
    const resolvedVideoSizeBytes = Number(normalizedVideo?.sizeBytes || 0) || resolvedInfoSizeBytes;
    if (
      resolvedInfoSizeBytes > MAX_VIDEO_UPLOAD_BYTES ||
      resolvedVideoSizeBytes > MAX_VIDEO_UPLOAD_BYTES
    ) {
      throw new Error(buildVideoSizeLimitMessage());
    }
    if (!normalizedVideoUri) {
      return file;
    }
    return {
      name: replaceVideoFileExtension(file.name),
      type: normalizeStorageText(normalizedVideo?.mimeType) || "video/mp4",
      uri: resolvedVideoUri,
    };
  }

  const prepared = await prepareLocalNormalizeUri(normalizedUri);
  if (!prepared) {
    return file;
  }

  try {
    const info = await getInfoAsync(prepared.localUri).catch(() => null);
    if (!info?.exists || info.isDirectory) {
      throw new Error("Fotoğraf bulunamadı.");
    }

    const constraints = STORAGE_IMAGE_CONSTRAINTS[folder];
    if (info.size > constraints.absoluteMaxSourceBytes) {
      throw new Error("Fotoğraf boyutu çok büyük. Lütfen daha küçük bir görsel seç.");
    }

    const preferredFormat = inferPreferredSaveFormat(folder, file);
    const dimensions = await readImageDimensions(prepared.localUri).catch(() => null);
    const resizeTarget = dimensions ? resolveResizeTarget(dimensions, constraints) : null;
    const shouldConvertFormat =
      preferredFormat === SaveFormat.WEBP &&
      !normalizeStorageText(file.type).toLowerCase().includes("webp");
    const shouldNormalize =
      Boolean(resizeTarget) || info.size > constraints.preferredMaxBytes || shouldConvertFormat;

    if (!shouldNormalize) {
      return file;
    }

    const normalized = await manipulateWithFormatFallback({
      compress: constraints.compress,
      format: preferredFormat,
      resizeTarget,
      sourceUri: prepared.localUri,
    });

    return {
      name: replaceFileExtension(file.name, normalized.format),
      type: resolveMimeType(normalized.format),
      uri: normalized.result.uri,
    };
  } finally {
    await prepared.cleanup();
  }
}
