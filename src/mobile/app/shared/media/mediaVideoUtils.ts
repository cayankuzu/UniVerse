export type MediaSelectionKind = "image" | "video";

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  webm: "video/webm",
};

const VIDEO_EXTENSIONS = Object.keys(VIDEO_MIME_BY_EXTENSION);
const IMAGE_EXTENSIONS = ["avif", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"];

export const TARGET_1080P_MEDIA_LONG_EDGE_PX = 1920;
export const TARGET_1080P_MEDIA_SHORT_EDGE_PX = 1080;
export const MAX_IMAGE_UPLOAD_DIMENSION_PX = TARGET_1080P_MEDIA_SHORT_EDGE_PX;
export const TARGET_1080P_VIDEO_WIDTH_PX = TARGET_1080P_MEDIA_LONG_EDGE_PX;
export const TARGET_1080P_VIDEO_HEIGHT_PX = TARGET_1080P_MEDIA_SHORT_EDGE_PX;
export const MAX_VIDEO_DURATION_SECONDS = 180;
export const MAX_VIDEO_UPLOAD_GRACE_SECONDS = 5;
export const MAX_VIDEO_UPLOAD_DURATION_SECONDS =
  MAX_VIDEO_DURATION_SECONDS + MAX_VIDEO_UPLOAD_GRACE_SECONDS;
export const MAX_VIDEO_DURATION_MS = MAX_VIDEO_DURATION_SECONDS * 1000;
export const MAX_VIDEO_UPLOAD_DURATION_MS = MAX_VIDEO_UPLOAD_DURATION_SECONDS * 1000;
export const TARGET_1080P_VIDEO_BITRATE_BPS = 8_500_000;
export const TARGET_1080P_AUDIO_BITRATE_BPS = 192_000;
export const MAX_VIDEO_UPLOAD_BYTES = Math.ceil(
  ((TARGET_1080P_VIDEO_BITRATE_BPS + TARGET_1080P_AUDIO_BITRATE_BPS) / 8) *
    MAX_VIDEO_UPLOAD_DURATION_SECONDS,
);
export const MAX_VIDEO_UPLOAD_LIMIT_MB = Math.max(
  1,
  Math.round(MAX_VIDEO_UPLOAD_BYTES / 1_000_000),
);

function normalizeMediaText(value: unknown) {
  return String(value || "").trim();
}

function inferVideoExtension(uri: string) {
  const normalized = normalizeMediaText(uri).toLowerCase();
  return VIDEO_EXTENSIONS.find((extension) => normalized.includes(`.${extension}`)) || "mp4";
}

export function isVideoMediaUri(uri: string) {
  const normalized = normalizeMediaText(uri).toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => normalized.includes(`.${extension}`));
}

export function isImageMediaUri(uri: string) {
  const normalized = normalizeMediaText(uri).toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => normalized.includes(`.${extension}`));
}

export function isSelectableVideoDuration(durationMs?: number | null) {
  return !Number.isFinite(durationMs) || Number(durationMs || 0) <= MAX_VIDEO_DURATION_MS;
}

export function buildVideoDurationLimitMessage() {
  return `Video süresi çok uzun. En fazla ${Math.floor(MAX_VIDEO_DURATION_SECONDS / 60)} dakikalık video yükleyebilirsin.`;
}

export function buildVideoSizeLimitMessage() {
  return `Video boyutu çok büyük. 1080p olarak hazırlandığında en fazla ${MAX_VIDEO_UPLOAD_LIMIT_MB} MB video yükleyebilirsin.`;
}

export function buildVideoCaptureLimitMessage() {
  return `Video ${Math.floor(MAX_VIDEO_DURATION_SECONDS / 60)} dakikayi asti. Daha kisa bir video cek.`;
}

export function buildVideoNormalizationFailureMessage() {
  return "Video 1080p olarak hazırlanamadı. Lütfen daha kısa veya farklı bir video seçip tekrar dene.";
}

export function formatMediaDuration(durationMs?: number | null) {
  const normalizedDurationMs = Number(durationMs || 0);
  if (!Number.isFinite(normalizedDurationMs) || normalizedDurationMs <= 0) {
    return "";
  }

  const totalSeconds = Math.max(1, Math.round(normalizedDurationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function resolveMediaUploadFileInfo(
  uri: string,
  params?: { baseName?: string; kind?: MediaSelectionKind },
) {
  const baseName = normalizeMediaText(params?.baseName) || "upload";
  const token = Date.now().toString(36);
  const isVideo = params?.kind === "video" || isVideoMediaUri(uri);

  if (isVideo) {
    const extension = inferVideoExtension(uri);
    return {
      kind: "video" as const,
      name: `${baseName}-${token}.${extension}`,
      type: VIDEO_MIME_BY_EXTENSION[extension] || "video/mp4",
    };
  }

  return {
    kind: "image" as const,
    name: `${baseName}-${token}.jpg`,
    type: "image/jpeg",
  };
}
