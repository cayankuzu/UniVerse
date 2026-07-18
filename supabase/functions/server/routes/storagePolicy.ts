export const STORAGE_BUCKET = "make-e3557d40-media";
export const STORAGE_SIGNED_URL_TTL_SECONDS = 60 * 10;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_SIGNED_UPLOAD_BYTES = 210 * 1024 * 1024;

const STORAGE_FOLDER_VALUES = ["albums", "avatars", "covers", "events", "profiles"] as const;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_SIGNED_UPLOAD_CONTENT_TYPES = new Set([
  ...ALLOWED_CONTENT_TYPES,
  "video/3gpp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-msvideo",
]);

const HEIF_SIGNATURE_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);

const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/3gpp": "3gp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
};

export type StorageFolder = (typeof STORAGE_FOLDER_VALUES)[number];

export class StorageRouteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StorageRouteError";
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeContentType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function sanitizeExtension(rawExtension: string) {
  return normalizeText(rawExtension)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sanitizeSourceName(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return "upload";
  const withoutExtension = normalized.replace(/\.[^.]+$/, "");
  const compact = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return compact || "upload";
}

function normalizeUploadKey(value: unknown) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return normalized || "";
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectSignatureContentType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 4, 8) === "ftyp" &&
    HEIF_SIGNATURE_BRANDS.has(readAscii(bytes, 8, 12).toLowerCase())
  ) {
    return "image/heif";
  }

  return null;
}

function contentTypeMatchesSignature(contentType: string, signatureContentType: string) {
  if (contentType === signatureContentType) return true;
  return (
    signatureContentType === "image/heif" &&
    (contentType === "image/heif" || contentType === "image/heic")
  );
}

function resolveVerifiedContentType(contentType: string, signatureContentType: string) {
  if (signatureContentType === "image/heif" && contentType === "image/heic") {
    return "image/heic";
  }
  return signatureContentType;
}

export function normalizeStorageFolder(value: unknown): StorageFolder {
  const normalized = normalizeText(value).toLowerCase();
  if (STORAGE_FOLDER_VALUES.includes(normalized as StorageFolder)) {
    return normalized as StorageFolder;
  }
  throw new StorageRouteError("Gecersiz yukleme klasoru", 400);
}

export function assertSignedUploadContentType(value: unknown) {
  const contentType = normalizeContentType(value);
  if (!ALLOWED_SIGNED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    throw new StorageRouteError("Desteklenmeyen dosya formati", 415);
  }
  return contentType;
}

export function assertSignedStoragePath(path: unknown) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) {
    throw new StorageRouteError("Path gerekli", 400);
  }
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length < 3) {
    throw new StorageRouteError("Path gecersiz", 400);
  }
  const folder = normalizeStorageFolder(segments[0]);
  const ownerId = normalizeText(segments[1]);
  const fileName = normalizeText(segments.slice(2).join("/"));
  if (!ownerId || !fileName || fileName.includes("..")) {
    throw new StorageRouteError("Path gecersiz", 400);
  }
  return {
    fileName,
    folder,
    normalizedPath,
    ownerId,
  };
}

export async function parseStorageUploadForm(formData: FormData, userId: string) {
  const rawFile = formData.get("file");
  if (!(rawFile instanceof Blob)) {
    throw new StorageRouteError("Dosya bulunamadi", 400);
  }

  const folder = normalizeStorageFolder(formData.get("folder"));
  const sourceName =
    rawFile instanceof File && normalizeText(rawFile.name)
      ? rawFile.name
      : `upload-${Date.now()}.jpg`;
  const uploadKey = normalizeUploadKey(formData.get("uploadKey"));
  const contentType = normalizeContentType((rawFile as File).type || rawFile.type);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new StorageRouteError("Desteklenmeyen dosya formati", 415);
  }

  const arrayBuffer = await rawFile.arrayBuffer();
  if (arrayBuffer.byteLength <= 0) {
    throw new StorageRouteError("Bos dosya yuklenemez", 400);
  }
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new StorageRouteError("Dosya boyutu limiti asildi", 413);
  }
  const signatureContentType = detectSignatureContentType(new Uint8Array(arrayBuffer));
  if (!signatureContentType) {
    throw new StorageRouteError("Dosya imzasi dogrulanamadi", 415);
  }
  if (!contentTypeMatchesSignature(contentType, signatureContentType)) {
    throw new StorageRouteError("Dosya tipi ve icerigi eslesmiyor", 415);
  }
  const verifiedContentType = resolveVerifiedContentType(contentType, signatureContentType);

  const sourceExtension = sanitizeExtension(sourceName.split(".").pop() || "");
  const verifiedExtension = CONTENT_TYPE_EXTENSION_MAP[verifiedContentType] || "jpg";
  const extension = sourceExtension === verifiedExtension ? sourceExtension : verifiedExtension;
  const objectStem = uploadKey
    ? sanitizeSourceName(uploadKey)
    : `${sanitizeSourceName(sourceName)}-${crypto.randomUUID()}`;
  const objectPath = `${folder}/${userId}/${objectStem}.${extension}`;

  return {
    arrayBuffer,
    contentType: verifiedContentType,
    folder,
    objectPath,
    sizeBytes: arrayBuffer.byteLength,
    uploadKey: uploadKey || null,
    verifiedContentType,
  };
}

export function buildSignedUploadObjectPath(params: {
  contentType: unknown;
  folder: unknown;
  sourceName: unknown;
  uploadKey?: unknown;
  userId: string;
}) {
  const folder = normalizeStorageFolder(params.folder);
  const contentType = assertSignedUploadContentType(params.contentType);

  const sourceName =
    normalizeText(params.sourceName) ||
    `upload-${Date.now()}.${CONTENT_TYPE_EXTENSION_MAP[contentType] || "bin"}`;
  const uploadKey = normalizeUploadKey(params.uploadKey);
  const sourceExtension = sanitizeExtension(sourceName.split(".").pop() || "");
  const defaultExtension = CONTENT_TYPE_EXTENSION_MAP[contentType] || "bin";
  const extension = sourceExtension || defaultExtension;
  const objectStem = uploadKey
    ? sanitizeSourceName(uploadKey)
    : `${sanitizeSourceName(sourceName)}-${crypto.randomUUID()}`;
  const objectPath = `${folder}/${normalizeText(params.userId)}/${objectStem}.${extension}`;

  return {
    contentType,
    folder,
    objectPath,
    uploadKey: uploadKey || null,
  };
}
