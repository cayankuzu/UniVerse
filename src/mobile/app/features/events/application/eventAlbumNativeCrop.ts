import {
  cacheDirectory,
  copyAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { NativeModules, Platform } from "react-native";

type NativeImageCropperModule = {
  crop: (uri: string) => Promise<string>;
};

const nativeImageCropper = NativeModules.NativeImageCropper as NativeImageCropperModule | undefined;
const CROP_SOURCE_CACHE_DIR = `${String(cacheDirectory || "").trim()}native-image-cropper/`;

function isCropCancelled(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "").trim();
  const message = String((error as { message?: string } | null)?.message || "")
    .trim()
    .toLowerCase();
  return code === "E_PICKER_CANCELLED" || message.includes("cancel");
}

function normalizeCropUri(value: string) {
  return String(value || "").trim();
}

function resolveCropSourceExtension(uri: string) {
  const match = normalizeCropUri(uri).match(/(\.[a-z0-9]{2,5})(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() || ".jpg";
}

async function ensureCropSourceUri(uri: string) {
  const normalizedUri = normalizeCropUri(uri);
  const isContentUri = normalizedUri.startsWith("content://");
  if (!normalizedUri || (!normalizedUri.startsWith("file://") && !isContentUri)) {
    return normalizedUri;
  }

  const normalizedCacheDirectory = normalizeCropUri(cacheDirectory || "");
  if (
    !isContentUri &&
    (!normalizedCacheDirectory || normalizedUri.startsWith(normalizedCacheDirectory))
  ) {
    return normalizedUri;
  }

  if (!isContentUri) {
    const sourceInfo = await getInfoAsync(normalizedUri).catch(() => null);
    if (!sourceInfo?.exists) {
      return normalizedUri;
    }
  }

  await makeDirectoryAsync(CROP_SOURCE_CACHE_DIR, { intermediates: true }).catch(() => undefined);
  const extension = resolveCropSourceExtension(normalizedUri);
  const targetUri = `${CROP_SOURCE_CACHE_DIR}source-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  await copyAsync({
    from: normalizedUri,
    to: targetUri,
  });
  return targetUri;
}

export async function cropEventAlbumPhoto(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (Platform.OS !== "android") {
    throw new Error("Yerel kırpma akışı bu sürümde sadece Android için hazırlandı.");
  }
  if (!nativeImageCropper?.crop) {
    throw new Error("Yerel kırpma modülü bulunamadı.");
  }

  try {
    return await nativeImageCropper.crop(await ensureCropSourceUri(uri));
  } catch (error) {
    if (isCropCancelled(error)) return null;
    throw error;
  }
}
