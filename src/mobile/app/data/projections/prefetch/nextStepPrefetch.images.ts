import { logProjectionMetric } from "../../../platform/observability";
import { debugWarn } from "../../../platform/logging/logger";
import { getMediaUriCacheKey } from "../../../shared/media/mediaUri";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import { appendProjectionFieldUris } from "../projectionImages.shared";

export const DEFAULT_INTENT_IMAGE_ITEMS = 2;
export const DEFAULT_INTENT_IMAGES = 1;

export async function prefetchIntentImages(params: {
  imageItems: unknown[];
  maxImages?: number;
  prefetchedImageUris: Set<string>;
  screenKey: string;
}) {
  const nextUris = collectIntentImageUris(params.imageItems)
    .slice(0, Math.max(0, params.maxImages ?? DEFAULT_INTENT_IMAGES))
    .filter((uri) => {
      const cacheKey = getMediaUriCacheKey(uri);
      if (!cacheKey || params.prefetchedImageUris.has(cacheKey)) return false;
      params.prefetchedImageUris.add(cacheKey);
      return true;
    });
  const prefetchedCount =
    nextUris.length > 0
      ? await preloadMediaSources(nextUris, {
          allowNetworkResolve: false,
          batchSize: 1,
        }).catch((error) => {
          debugWarn("PROJECTIONS/PREFETCH", "intent-image-prefetch-failed", {
            message: String(
              (error as { message?: string } | null)?.message || "intent-image-prefetch-failed",
            ),
            screenKey: params.screenKey,
          });
          return 0;
        })
      : 0;

  logProjectionMetric({
    meta: {
      requested: params.imageItems.length,
      resolved: prefetchedCount,
      scheduled: nextUris.length,
      skipped: Math.max(0, params.imageItems.length - nextUris.length),
      unresolved: Math.max(0, nextUris.length - prefetchedCount),
    },
    name: "image_prefetch_hit_metrics",
    screenKey: params.screenKey,
    status: prefetchedCount > 0 ? "ok" : "skipped",
  });
}

function collectIntentImageUris(items: unknown[]) {
  const uris = new Set<string>();

  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: false,
      rawUri: record.image,
      variants: record.imageVariants || record.image_variants,
    });
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: false,
      rawUri: record.coverImage || record.cover_image,
      variants: record.coverImageVariants || record.cover_image_variants,
    });
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: false,
      rawUri: record.profileImage || record.profile_image,
      variants: record.profileImageVariants || record.profile_image_variants,
    });
  });

  return Array.from(uris);
}
