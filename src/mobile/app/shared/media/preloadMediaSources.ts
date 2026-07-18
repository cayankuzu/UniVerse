import { Image as ExpoImage } from "expo-image";
import { resolveMediaSources, type ResolvedMediaSource } from "./mediaUri";
import { runLowPriorityTask } from "../utils/lowPriorityTaskScheduler";

const DEFAULT_BATCH_SIZE = 2;

function chunkSources(sources: ResolvedMediaSource[], batchSize: number) {
  const chunks: ResolvedMediaSource[][] = [];
  for (let index = 0; index < sources.length; index += batchSize) {
    chunks.push(sources.slice(index, index + batchSize));
  }
  return chunks;
}

export async function preloadResolvedMediaSources(
  sources: ResolvedMediaSource[],
  options?: { batchSize?: number; priority?: "deferred" | "eager" },
) {
  const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_BATCH_SIZE);
  const batches = chunkSources(sources, batchSize);

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map((source) =>
        options?.priority === "eager"
          ? ExpoImage.loadAsync({
              cacheKey: source.cacheKey,
              uri: source.uri,
            })
          : runLowPriorityTask(
              () =>
                ExpoImage.loadAsync({
                  cacheKey: source.cacheKey,
                  uri: source.uri,
                }),
              { key: `media-preload:${source.cacheKey}` },
            ),
      ),
    );
  }

  return sources.length;
}

export async function preloadMediaSources(
  uris: Array<string | null | undefined>,
  options?: {
    allowNetworkResolve?: boolean;
    batchSize?: number;
    priority?: "deferred" | "eager";
  },
) {
  const sources = await resolveMediaSources(uris, {
    allowNetworkResolve: options?.allowNetworkResolve,
  });
  if (sources.length === 0) return 0;
  return preloadResolvedMediaSources(sources, options);
}
