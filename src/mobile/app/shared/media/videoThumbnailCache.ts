import { requireOptionalNativeModule } from "expo-modules-core";
import type { VideoThumbnail } from "expo-video";
import { runLowPriorityTask } from "../utils/lowPriorityTaskScheduler";

type ExpoVideoThumbnailsModule = {
  getThumbnail: (
    sourceFilename: string,
    options: { quality: number; time: number },
  ) => Promise<{ uri: string }>;
};

let cachedNativeModule: ExpoVideoThumbnailsModule | null | undefined;

function getVideoThumbnailsModule() {
  if (cachedNativeModule !== undefined) return cachedNativeModule;
  cachedNativeModule =
    requireOptionalNativeModule<ExpoVideoThumbnailsModule>("ExpoVideoThumbnails");
  return cachedNativeModule;
}

const thumbnailCache = new Map<string, VideoThumbnail | null>();
const thumbnailInflightCache = new Map<string, Promise<VideoThumbnail | null>>();
const MAX_THUMBNAIL_CACHE_ENTRIES = 96;
const VIDEO_THUMBNAIL_QUALITY = 0.72;
const VIDEO_THUMBNAIL_SAMPLE_TIMES_SECONDS = [0.35, 0.18, 0.05];

function normalizeUri(value: string | null | undefined) {
  return String(value || "").trim();
}

export function getCachedVideoThumbnail(uri: string | null | undefined) {
  const normalizedUri = normalizeUri(uri);
  if (!normalizedUri) return null;
  const thumbnail = thumbnailCache.get(normalizedUri) ?? null;
  if (thumbnailCache.has(normalizedUri)) {
    thumbnailCache.delete(normalizedUri);
    thumbnailCache.set(normalizedUri, thumbnail);
  }
  return thumbnail;
}

function cacheVideoThumbnail(uri: string, thumbnail: VideoThumbnail | null) {
  thumbnailCache.delete(uri);
  thumbnailCache.set(uri, thumbnail);
  while (thumbnailCache.size > MAX_THUMBNAIL_CACHE_ENTRIES) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    thumbnailCache.delete(oldestKey);
  }
}

export function clearVideoThumbnailMemoryCache() {
  thumbnailCache.clear();
}

async function resolveViaNativeModule(uri: string): Promise<VideoThumbnail | null> {
  const mod = getVideoThumbnailsModule();
  if (!mod?.getThumbnail) return null;

  for (const timeSec of VIDEO_THUMBNAIL_SAMPLE_TIMES_SECONDS) {
    try {
      const result = await mod.getThumbnail(uri, {
        quality: VIDEO_THUMBNAIL_QUALITY,
        time: Math.max(0, timeSec * 1000),
      });
      if (result?.uri) {
        return { uri: result.uri } as unknown as VideoThumbnail;
      }
    } catch {
      // try next sample time
    }
  }
  return null;
}

async function resolveViaVideoPlayer(uri: string): Promise<VideoThumbnail | null> {
  const { createVideoPlayer } = require("expo-video") as typeof import("expo-video");
  const player = createVideoPlayer(uri);
  try {
    const thumbnails = await player.generateThumbnailsAsync(VIDEO_THUMBNAIL_SAMPLE_TIMES_SECONDS, {
      maxHeight: 480,
      maxWidth: 480,
    });
    return thumbnails.find(Boolean) || null;
  } catch {
    return null;
  } finally {
    player.release();
  }
}

export async function resolveVideoThumbnail(
  uri: string | null | undefined,
  options?: { priority?: "deferred" | "eager" },
) {
  const normalizedUri = normalizeUri(uri);
  if (!normalizedUri) return null;

  if (thumbnailCache.has(normalizedUri)) {
    return thumbnailCache.get(normalizedUri) ?? null;
  }
  const inflight = thumbnailInflightCache.get(normalizedUri);
  if (inflight) return inflight;

  const generateThumbnail = async () => {
    const thumbnail =
      (await resolveViaNativeModule(normalizedUri)) || (await resolveViaVideoPlayer(normalizedUri));
    cacheVideoThumbnail(normalizedUri, thumbnail);
    return thumbnail;
  };
  const pending = (
    options?.priority === "eager"
      ? Promise.resolve().then(generateThumbnail)
      : runLowPriorityTask(generateThumbnail, { key: `video-thumbnail:${normalizedUri}` })
  ).finally(() => {
    thumbnailInflightCache.delete(normalizedUri);
  });
  thumbnailInflightCache.set(normalizedUri, pending);
  return pending;
}

export async function generateVideoThumbnailUri(uri: string, timeMs = 0) {
  const mod = getVideoThumbnailsModule();
  if (!mod?.getThumbnail) return undefined;

  try {
    const result = await mod.getThumbnail(uri, {
      quality: VIDEO_THUMBNAIL_QUALITY,
      time: Math.max(0, timeMs),
    });
    return result?.uri;
  } catch {
    return undefined;
  }
}
