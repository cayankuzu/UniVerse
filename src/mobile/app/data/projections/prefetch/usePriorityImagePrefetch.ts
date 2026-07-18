import { useEffect, useRef } from "react";
import { debugWarn } from "../../../platform/logging/logger";
import { getMediaUriCacheKey } from "../../../shared/media/mediaUri";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import { logPerformanceBudgetTrim } from "../dataLoadingTelemetry";
import { resolveNetworkBudget } from "../networkAwareBudget";
import { resolvePrefetchPerformanceBudget, type PerformanceTier } from "../performanceBudget";
import { collectPriorityImageUris } from "./priorityImagePrefetch.shared";

export function usePriorityImagePrefetch<T>(params: {
  disabled?: boolean;
  items: T[];
  maxImages?: number;
  scopeKey: string;
  tier?: PerformanceTier;
}) {
  const completedKeysRef = useRef(new Set<string>());
  const pendingKeysRef = useRef(new Set<string>());
  const prefetchBudget = resolvePrefetchPerformanceBudget(params.tier || "tier1");
  const maxImages = params.maxImages ?? prefetchBudget.maxPriorityImages;

  useEffect(() => {
    completedKeysRef.current.clear();
    pendingKeysRef.current.clear();
  }, [params.scopeKey]);

  useEffect(() => {
    if (params.disabled || params.items.length === 0) return;

    const networkBudget = resolveNetworkBudget();
    if (!networkBudget.allowImagePrefetch) return;

    const rawUris = collectPriorityImageUris(params.items.slice(0, maxImages), maxImages);
    const nextUris = rawUris.filter((uri) => {
      const cacheKey = getMediaUriCacheKey(uri);
      return Boolean(
        cacheKey &&
        !completedKeysRef.current.has(cacheKey) &&
        !pendingKeysRef.current.has(cacheKey),
      );
    });
    if (nextUris.length === 0) return;
    if (rawUris.length > nextUris.length) {
      logPerformanceBudgetTrim({
        applied: nextUris.length,
        budget: "priority-image-prefetch",
        requested: rawUris.length,
        screenKey: params.scopeKey,
      });
    }

    nextUris.forEach((uri) => {
      const cacheKey = getMediaUriCacheKey(uri);
      if (cacheKey) pendingKeysRef.current.add(cacheKey);
    });

    let cancelled = false;
    void preloadMediaSources(nextUris, {
      allowNetworkResolve: true,
      batchSize: Math.min(2, nextUris.length),
      priority: "eager",
    })
      .then((resolvedCount) => {
        if (cancelled) return;
        nextUris.forEach((uri) => {
          const cacheKey = getMediaUriCacheKey(uri);
          if (!cacheKey) return;
          pendingKeysRef.current.delete(cacheKey);
          if (resolvedCount >= nextUris.length) completedKeysRef.current.add(cacheKey);
        });
      })
      .catch((error) => {
        debugWarn("PROJECTIONS/PREFETCH", "priority-image-prefetch-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "priority-image-prefetch-failed",
          ),
          scopeKey: params.scopeKey,
        });
        nextUris.forEach((uri) => {
          const cacheKey = getMediaUriCacheKey(uri);
          if (cacheKey) pendingKeysRef.current.delete(cacheKey);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [maxImages, params.disabled, params.items, params.scopeKey]);
}
