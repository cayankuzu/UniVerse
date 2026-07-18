/**
 * Prefetches images for newly loaded pagination items.
 *
 * When a list's item count grows (loadMore), this hook extracts image URIs
 * from the new items and pre-warms them into expo-image's memory-disk cache.
 * Skipped on degraded/offline networks.
 */
import { useEffect, useRef } from "react";
import { debugWarn } from "../../../platform/logging/logger";
import { resolveNetworkBudget } from "../networkAwareBudget";
import { isVideoMediaUri } from "../../../shared/media/mediaVideoUtils";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import { logNextPageImagePrefetch, logPerformanceBudgetTrim } from "../dataLoadingTelemetry";
import { resolvePrefetchPerformanceBudget, type PerformanceTier } from "../performanceBudget";

function extractRawImageUris(items: unknown[]): string[] {
  const uris: string[] = [];
  const appendPreferredVariantUris = (variants: Record<string, unknown> | null) => {
    if (!variants) return;
    const thumb = String(variants.thumbnail || "").trim();
    if (thumb) uris.push(thumb);
  };
  const appendRecordUris = (record: Record<string, unknown> | null) => {
    if (!record) return;
    const variants = (record.imageVariants || record.image_variants || null) as Record<
      string,
      unknown
    > | null;
    if (variants && typeof variants === "object") {
      appendPreferredVariantUris(variants);
    } else {
      const rawImageUri = String(record.image || "").trim();
      if (rawImageUri && !isVideoMediaUri(rawImageUri)) uris.push(rawImageUri);
    }
    const coverVariants = (record.coverImageVariants ||
      record.cover_image_variants ||
      null) as Record<string, unknown> | null;
    if (coverVariants && typeof coverVariants === "object") {
      appendPreferredVariantUris(coverVariants);
    } else {
      const rawCoverUri = String(record.coverImage || record.cover_image || "").trim();
      if (rawCoverUri) uris.push(rawCoverUri);
    }
  };
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    appendRecordUris(row);
    appendRecordUris(
      row.event && typeof row.event === "object" ? (row.event as Record<string, unknown>) : null,
    );
    appendRecordUris(
      row.album && typeof row.album === "object" ? (row.album as Record<string, unknown>) : null,
    );
  }
  return uris;
}

export function useNextPageImagePrefetch<T>(params: {
  disabled?: boolean;
  items: T[];
  maxImages?: number;
  screenKey?: string;
  tier?: PerformanceTier;
}) {
  const previousCountRef = useRef(0);
  const budget = resolvePrefetchPerformanceBudget(params.tier || "tier1");
  const maxImages = params.maxImages ?? budget.maxNextPageImages;

  useEffect(() => {
    const prevCount = previousCountRef.current;
    const currentCount = params.items.length;
    previousCountRef.current = currentCount;

    if (params.disabled || currentCount <= prevCount || prevCount === 0) return;

    const networkBudget = resolveNetworkBudget();
    if (!networkBudget.allowImagePrefetch) return;

    const newItems = params.items.slice(prevCount, prevCount + maxImages);
    const rawUris = extractRawImageUris(newItems);
    if (rawUris.length === 0) return;
    const trimmedUris = rawUris.slice(0, maxImages);
    if (params.screenKey && rawUris.length > trimmedUris.length) {
      logPerformanceBudgetTrim({
        applied: trimmedUris.length,
        budget: "next-page-image-prefetch",
        requested: rawUris.length,
        screenKey: params.screenKey,
      });
    }
    void preloadMediaSources(trimmedUris, {
      allowNetworkResolve: true,
      batchSize: Math.min(2, trimmedUris.length),
      priority: "eager",
    })
      .then((resolvedCount) => {
        if (resolvedCount > 0) {
          if (params.screenKey) {
            logNextPageImagePrefetch({
              newItemCount: newItems.length,
              prefetchedCount: resolvedCount,
              screenKey: params.screenKey,
              skippedCount: Math.max(0, trimmedUris.length - resolvedCount),
            });
          }
          return;
        }
        if (params.screenKey) {
          logNextPageImagePrefetch({
            newItemCount: newItems.length,
            prefetchedCount: 0,
            screenKey: params.screenKey,
            skippedCount: trimmedUris.length,
          });
        }
      })
      .catch((error) => {
        debugWarn("PROJECTIONS/PREFETCH", "next-page-image-prefetch-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "next-page-image-prefetch-failed",
          ),
          screenKey: params.screenKey,
        });
      });
  }, [maxImages, params.disabled, params.items, params.items.length, params.screenKey]);
}
