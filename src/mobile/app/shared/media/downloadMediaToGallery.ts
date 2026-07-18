import { resolveMediaUri } from "./mediaUri";

const TEMP_DIRECTORY = "media-download-cache";

export type DownloadableMediaKind = "image" | "video";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function sanitizeFileStem(value: string) {
  const normalized = normalizeText(value).replace(/\.[^.]+$/, "");
  const compact = normalized
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return compact || "media";
}

function inferExtension(uri: string, kind?: DownloadableMediaKind, fileName?: string | null) {
  const candidates = [
    normalizeText(fileName),
    (() => {
      try {
        return new URL(uri).pathname.split("/").pop() || "";
      } catch {
        return uri.split("/").pop() || "";
      }
    })(),
    kind === "video" ? "media.mp4" : "media.jpg",
  ];
  for (const candidate of candidates) {
    const match = normalizeText(candidate).match(/\.([a-z0-9]{2,6})$/i);
    if (match?.[1]) return `.${match[1].toLowerCase()}`;
  }
  return kind === "video" ? ".mp4" : ".jpg";
}

async function ensureMediaLibraryPermission() {
  const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Galeri izni gerekli.");
  }
}

async function prepareLocalUri(params: {
  fileName?: string | null;
  kind?: DownloadableMediaKind;
  uri: string;
}) {
  const { cacheDirectory, copyAsync, deleteAsync, downloadAsync, makeDirectoryAsync } =
    require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const normalizedUri = normalizeText(params.uri);
  const baseCacheDirectory = normalizeText(cacheDirectory);
  if (!baseCacheDirectory) {
    throw new Error("Medya kaydedilemedi.");
  }

  const tempDirectory = `${baseCacheDirectory.replace(/\/?$/, "/")}${TEMP_DIRECTORY}/`;
  await makeDirectoryAsync(tempDirectory, { intermediates: true }).catch(() => null);
  const extension = inferExtension(normalizedUri, params.kind, params.fileName);
  const fileStem = sanitizeFileStem(params.fileName || `media-${Date.now().toString(36)}`);
  const localUri = `${tempDirectory}${fileStem}-${Date.now().toString(36)}${extension}`;

  if (/^https?:/i.test(normalizedUri)) {
    await downloadAsync(normalizedUri, localUri).catch((error) => {
      throw new Error(
        String((error as { message?: string } | null)?.message || "Medya indirilemedi."),
      );
    });
  } else {
    await copyAsync({ from: normalizedUri, to: localUri }).catch((error) => {
      throw new Error(
        String((error as { message?: string } | null)?.message || "Medya kopyalanamadi."),
      );
    });
  }

  return {
    cleanup: async () => {
      await deleteAsync(localUri, { idempotent: true }).catch(() => null);
    },
    localUri,
  };
}

async function tryDirectSave(uri: string) {
  const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
  const normalizedUri = normalizeText(uri);
  if (!normalizedUri || /^https?:/i.test(normalizedUri)) return false;

  try {
    await MediaLibrary.createAssetAsync(normalizedUri);
    return true;
  } catch {
    try {
      await MediaLibrary.saveToLibraryAsync(normalizedUri);
      return true;
    } catch {
      return false;
    }
  }
}

export async function downloadMediaToGallery(params: {
  fileName?: string | null;
  kind?: DownloadableMediaKind;
  uri: string;
}) {
  const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
  await ensureMediaLibraryPermission();
  const resolvedUri = normalizeText(await resolveMediaUri(params.uri)) || normalizeText(params.uri);
  const nextParams = {
    ...params,
    uri: resolvedUri,
  };

  if (await tryDirectSave(nextParams.uri)) {
    return;
  }

  const prepared = await prepareLocalUri(nextParams);
  try {
    try {
      await MediaLibrary.createAssetAsync(prepared.localUri);
      return;
    } catch {
      await MediaLibrary.saveToLibraryAsync(prepared.localUri);
    }
  } finally {
    await prepared.cleanup();
  }
}
