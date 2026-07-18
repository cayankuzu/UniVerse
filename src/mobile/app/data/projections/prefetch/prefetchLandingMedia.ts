import { resolveNetworkBudget } from "../networkAwareBudget";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import type { ProjectionPrefetchSource } from "./prefetchRegistry";
import { runProjectionPrefetchTask } from "./prefetchProjection";
import { collectPriorityImageUris } from "./priorityImagePrefetch.shared";

export async function prefetchLandingMedia(params: {
  items: unknown[];
  maxImages: number;
  screenKey: string;
  source: ProjectionPrefetchSource;
}) {
  if (!resolveNetworkBudget().allowImagePrefetch) return 0;
  const uris = collectPriorityImageUris(params.items, params.maxImages);
  if (uris.length === 0) return 0;

  return runProjectionPrefetchTask({
    key: `landing-media-prefetch:${params.screenKey}`,
    source: params.source,
    task: () =>
      preloadMediaSources(uris, {
        allowNetworkResolve: true,
        batchSize: Math.min(2, uris.length),
        priority: "eager",
      }),
  });
}
