import type { QueryClient } from "@tanstack/react-query";
import { debugWarn } from "../../../platform/logging/logger";

import type { AlbumPhotoWithMeta, EventWithMeta } from "../../contracts/content";
import type { ProjectionHomeFeedItem } from "../projections.types";
import type { ProjectionPrefetchSource } from "./prefetchRegistry";
import { logNetworkBudgetSkip } from "../dataLoadingTelemetry";
import { resolveNetworkBudget } from "../networkAwareBudget";
import { DEFAULT_INTENT_IMAGE_ITEMS, prefetchIntentImages } from "./nextStepPrefetch.images";
import {
  collectHomeNextStepTargets,
  collectProfileNextStepTargets,
  settleNextStepTasks,
} from "./nextStepPrefetch.targets";

export async function prefetchHomeNextStepExperience(params: {
  eventPrefetchMode?: "album" | "detail";
  items: ProjectionHomeFeedItem[];
  maxImageItems?: number;
  maxImages?: number;
  maxTargets?: number;
  prefetchedImageUris: Set<string>;
  prefetchedTargets: Set<string>;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const networkBudget = resolveNetworkBudget();
  if (!networkBudget.allowIntentPrefetch && !networkBudget.allowImagePrefetch) {
    logNetworkBudgetSkip({
      action: "intent-prefetch",
      quality: networkBudget.quality,
      screenKey: `${params.viewerKey}:home-intent`,
    });
    return;
  }
  const { imageItems, tasks } = collectHomeNextStepTargets({
    ...params,
    maxImageItems: Math.max(0, params.maxImageItems ?? DEFAULT_INTENT_IMAGE_ITEMS),
  });

  const imageTask = networkBudget.allowImagePrefetch
    ? prefetchIntentImages({
        imageItems,
        maxImages: params.maxImages,
        prefetchedImageUris: params.prefetchedImageUris,
        screenKey: `${params.viewerKey}:home-intent`,
      })
    : Promise.resolve();
  if (networkBudget.allowIntentPrefetch) {
    await settleNextStepTasks(tasks);
  }
  await imageTask.catch((error) => {
    debugWarn("PROJECTIONS/PREFETCH", "home-next-step-image-prefetch-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "home-next-step-image-prefetch-failed",
      ),
      viewerKey: params.viewerKey,
    });
  });
}

export async function prefetchProfileNextStepExperience(params: {
  albums: AlbumPhotoWithMeta[];
  eventPrefetchMode?: "album" | "detail";
  events: EventWithMeta[];
  maxImages?: number;
  maxTargets?: number;
  prefetchedImageUris: Set<string>;
  prefetchedTargets: Set<string>;
  queryClient: QueryClient;
  screenKey: string;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const networkBudget = resolveNetworkBudget();
  if (!networkBudget.allowIntentPrefetch && !networkBudget.allowImagePrefetch) {
    logNetworkBudgetSkip({
      action: "intent-prefetch",
      quality: networkBudget.quality,
      screenKey: params.screenKey,
    });
    return;
  }
  const { imageItems, tasks } = collectProfileNextStepTargets(params);
  const imageTask = networkBudget.allowImagePrefetch
    ? prefetchIntentImages({
        imageItems,
        maxImages: params.maxImages,
        prefetchedImageUris: params.prefetchedImageUris,
        screenKey: params.screenKey,
      })
    : Promise.resolve();

  if (networkBudget.allowIntentPrefetch) {
    await settleNextStepTasks(tasks);
  }
  await Promise.allSettled([imageTask]);
}
