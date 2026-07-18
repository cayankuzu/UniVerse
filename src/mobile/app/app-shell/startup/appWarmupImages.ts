import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { logProjectionMetric } from "../../platform/observability";
import { resolveMediaSources } from "../../shared/media/mediaUri";
import { preloadResolvedMediaSources } from "../../shared/media/preloadMediaSources";
import { collectWarmupBundleItems, takeFreshWarmupImageUris } from "./appWarmupHelpers";

type ImagePrefetchParams = {
  bundle: AppWarmupBundle;
  maxImages: number;
  prefetchedImageUris: Set<string>;
  viewerKey: string;
};

/**
 * Resolves fresh image URIs from the warmup bundle and prefetches them via
 * Expo Image.  Returns the resolved URI list so callers can track what was
 * prefetched.
 */
export function buildImagePrefetchTask(params: ImagePrefetchParams): {
  imageUris: string[];
  task: (() => Promise<void>) | null;
} {
  const bundleItems = collectWarmupBundleItems(params.bundle);
  const imageUris = takeFreshWarmupImageUris(
    bundleItems,
    params.prefetchedImageUris,
    params.maxImages,
  );

  const totalRequested = bundleItems.length;

  if (imageUris.length === 0) {
    logProjectionMetric({
      meta: {
        requested: totalRequested,
        resolved: 0,
        scheduled: 0,
        skipped: totalRequested,
        unresolved: 0,
      },
      name: "image_prefetch_hit_metrics",
      screenKey: params.viewerKey,
      status: "skipped",
    });
    return { imageUris, task: null };
  }

  const task = async () => {
    const prefetchedSources = await resolveMediaSources(imageUris, {
      allowNetworkResolve: true,
    });
    logProjectionMetric({
      meta: {
        requested: totalRequested,
        resolved: prefetchedSources.length,
        scheduled: imageUris.length,
        skipped: Math.max(0, totalRequested - imageUris.length),
        unresolved: Math.max(0, imageUris.length - prefetchedSources.length),
      },
      name: "image_prefetch_hit_metrics",
      screenKey: params.viewerKey,
      status: prefetchedSources.length > 0 ? "ok" : "skipped",
    });
    if (prefetchedSources.length > 0) {
      await preloadResolvedMediaSources(prefetchedSources, { batchSize: 1 });
    }
  };

  return { imageUris, task };
}
