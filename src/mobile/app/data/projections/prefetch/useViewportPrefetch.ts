/**
 * Generic viewport-aware prefetch hook.
 *
 * Fires prefetch for items that become visible in any list screen.
 * Feature screens provide a `resolvePrefetchTargets` callback that
 * extracts prefetch-worthy targets (event IDs, profile usernames)
 * from each visible item.
 *
 * Usage:
 *   const { onViewableItemsChanged, viewabilityConfig } = useViewportPrefetch({
 *     resolvePrefetchTargets: (item) => [{ type: "event", id: item.eventId }],
 *     scopeKey: filterScope,
 *     viewerKey,
 *     viewerUserId: userData.id,
 *     viewerUsername: userData.username,
 *   });
 */
import { useEffect, useMemo, useRef } from "react";
import type { ViewToken } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  logNetworkBudgetSkip,
  logPerformanceBudgetTrim,
  logViewportPrefetchFired,
} from "../dataLoadingTelemetry";
import { prefetchEventExperience, prefetchProfileExperience } from "./intentPrefetch";
import { resolveNetworkBudget } from "../networkAwareBudget";
import {
  resolvePrefetchPerformanceBudget,
  resolveProjectionPerformanceBudget,
  type PerformanceTier,
} from "../performanceBudget";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewportPrefetchTarget =
  { type: "event"; id: string } | { type: "profile"; username: string };

export interface UseViewportPrefetchOptions<T> {
  /** If true, viewport prefetch is completely disabled. */
  disabled?: boolean;
  /** Maximum number of prefetch targets to fire per viewability change event. */
  maxTargetsPerBatch?: number;
  /** Override the list's minimum visible duration before the callback fires. */
  minimumViewTimeMs?: number;
  /** Extracts prefetch targets from a visible item. Return empty array to skip. */
  resolvePrefetchTargets: (item: T) => ViewportPrefetchTarget[];
  /** Scope key — when this changes, the dedup set resets. */
  scopeKey: string;
  /** Viewer key used for cache key generation. */
  viewerKey: string;
  /** Viewer user ID for projection fetches. */
  viewerUserId?: string;
  /** Viewer username for profile projection fetches. */
  viewerUsername: string;
  /** Shared tier budget for viewport prefetch. */
  tier?: PerformanceTier;
  /** Override the visible percentage required for the callback. */
  visiblePercentThreshold?: number;
  /** Allow first-fold items to become viewable before a user gesture. */
  waitForInteraction?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewportPrefetch<T>(options: UseViewportPrefetchOptions<T>) {
  const queryClient = useQueryClient();
  const prefetchedTargetsRef = useRef(new Set<string>());
  const optionsRef = useRef(options);
  const budget = resolvePrefetchPerformanceBudget(options.tier || "tier1");

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    prefetchedTargetsRef.current.clear();
  }, [options.scopeKey, options.viewerKey]);

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { changed: ViewToken[]; viewableItems: ViewToken[] }) => {
      const currentOptions = optionsRef.current;
      if (currentOptions.disabled) return;
      const currentBudget = resolvePrefetchPerformanceBudget(currentOptions.tier || "tier1");
      const maxTargets = currentOptions.maxTargetsPerBatch ?? currentBudget.maxTargetsPerBatch;

      const networkBudget = resolveNetworkBudget();
      if (!networkBudget.allowIntentPrefetch) {
        logNetworkBudgetSkip({
          action: "viewport-prefetch",
          quality: networkBudget.quality,
          screenKey: currentOptions.scopeKey,
        });
        return;
      }

      let scheduledCount = 0;
      let requestedCount = 0;
      let scheduledEventCount = 0;
      let scheduledProfileCount = 0;

      for (const token of viewableItems) {
        if (!token.isViewable || scheduledCount >= maxTargets) break;
        const item = token.item as T | undefined;
        if (!item) continue;

        const targets = currentOptions.resolvePrefetchTargets(item);
        requestedCount += targets.length;
        for (const target of targets) {
          if (scheduledCount >= maxTargets) break;
          const surfaceEnabled =
            target.type === "event"
              ? resolveProjectionPerformanceBudget("event-detail").prefetchPolicy !== "none"
              : resolveProjectionPerformanceBudget("profile").prefetchPolicy !== "none";
          if (!surfaceEnabled) continue;
          const dedupeKey =
            target.type === "event" ? `event:${target.id}` : `profile:${target.username}`;
          if (prefetchedTargetsRef.current.has(dedupeKey)) continue;
          prefetchedTargetsRef.current.add(dedupeKey);
          scheduledCount += 1;

          if (target.type === "event") {
            scheduledEventCount += 1;
            void prefetchEventExperience({
              eventId: target.id,
              queryClient,
              source: "viewport",
              viewerId: currentOptions.viewerUserId,
              viewerKey: currentOptions.viewerKey,
            });
          } else {
            scheduledProfileCount += 1;
            void prefetchProfileExperience({
              queryClient,
              username: target.username,
              viewerId: currentOptions.viewerUserId,
              viewerKey: currentOptions.viewerKey,
              viewerUsername: currentOptions.viewerUsername,
            });
          }
        }
      }

      if (requestedCount > scheduledCount) {
        logPerformanceBudgetTrim({
          applied: scheduledCount,
          budget: "viewport-prefetch-targets",
          requested: requestedCount,
          screenKey: currentOptions.scopeKey,
        });
      }

      if (scheduledEventCount > 0) {
        logViewportPrefetchFired({
          screenKey: currentOptions.scopeKey,
          targetCount: scheduledEventCount,
          targetType: "event",
        });
      }

      if (scheduledProfileCount > 0) {
        logViewportPrefetchFired({
          screenKey: currentOptions.scopeKey,
          targetCount: scheduledProfileCount,
          targetType: "profile",
        });
      }
    },
  );

  const itemVisiblePercentThreshold =
    options.visiblePercentThreshold ?? budget.visiblePercentThreshold;
  const minimumViewTime = options.minimumViewTimeMs ?? budget.viewportMinimumViewTimeMs;
  const waitForInteraction = options.waitForInteraction ?? true;
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold,
      minimumViewTime,
      waitForInteraction,
    }),
    [itemVisiblePercentThreshold, minimumViewTime, waitForInteraction],
  );

  return useMemo(
    () => ({
      onViewableItemsChanged: onViewableItemsChangedRef.current,
      viewabilityConfig,
    }),
    [viewabilityConfig],
  );
}
