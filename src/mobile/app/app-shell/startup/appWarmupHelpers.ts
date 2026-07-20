import {
  collectImageVariantUris,
  type ImageVariantKey,
  type ImageVariants,
} from "../../data/normalizers/media";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { getMediaUriCacheKey } from "../../shared/media/mediaUri";
import { isVideoMediaUri } from "../../shared/media/mediaVideoUtils";

const DEFAULT_WARMUP_IMAGE_PREFETCH = 2;

export function takeFreshWarmupImageUris(
  items: unknown[],
  seenUris: Set<string>,
  maxCount = DEFAULT_WARMUP_IMAGE_PREFETCH,
) {
  const imageUris = collectWarmupImageUris(items, maxCount);
  return imageUris.filter((uri) => {
    const cacheKey = getMediaUriCacheKey(uri);
    if (!cacheKey || seenUris.has(cacheKey)) return false;
    seenUris.add(cacheKey);
    return true;
  });
}

function collectWarmupImageUris(items: unknown[], maxCount: number) {
  const images = new Set<string>();
  const addUri = (value: unknown) => {
    const path = String(value || "").trim();
    if (path) images.add(path);
  };
  const addPreferredUris = (variants: unknown, preferredOrder: ImageVariantKey[], limit = 1) => {
    const uris = collectImageVariantUris(variants as ImageVariants | null | undefined, {
      fallbackToFull: false,
      limit,
      preferredOrder,
    });
    uris.forEach((uri) => {
      images.add(uri);
    });
  };
  const appendRecordImageUris = (record: Record<string, unknown>) => {
    const imageVariants = record.imageVariants || record.image_variants;
    const coverImageVariants = record.coverImageVariants || record.cover_image_variants;
    const profileImageVariants = record.profileImageVariants || record.profile_image_variants;
    if (imageVariants) {
      addPreferredUris(imageVariants, ["thumbnail", "medium"]);
    } else {
      const rawImage = String(record.image || "").trim();
      if (!isVideoMediaUri(rawImage)) addUri(rawImage);
    }
    if (coverImageVariants) {
      addPreferredUris(coverImageVariants, ["thumbnail", "medium"]);
    } else {
      addUri(record.coverImage || record.cover_image);
    }
    if (profileImageVariants) {
      addPreferredUris(profileImageVariants, ["thumbnail", "medium"]);
    } else {
      addUri(record.profileImage || record.profile_image);
    }
    addUri(record.clubImage);
    addUri(record.userImage);
  };

  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const event = row.kind === "event" ? row.event : row.event || row;
    const album = row.kind === "album" ? row.album : row.album || row;
    const overview =
      row.overview && typeof row.overview === "object"
        ? (row.overview as Record<string, unknown>)
        : null;
    const profile = row.profile || overview?.profile || null;
    appendRecordImageUris(row);
    if (event && typeof event === "object") appendRecordImageUris(event as Record<string, unknown>);
    if (album && typeof album === "object") appendRecordImageUris(album as Record<string, unknown>);
    if (profile && typeof profile === "object")
      appendRecordImageUris(profile as Record<string, unknown>);
  });
  return Array.from(images).slice(0, Math.max(0, maxCount));
}

export function collectWarmupBundleItems(bundle: AppWarmupBundle) {
  return bundle.home.items || [];
}
