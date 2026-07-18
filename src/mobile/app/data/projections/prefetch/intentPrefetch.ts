import type { QueryClient } from "@tanstack/react-query";
import { getProfileOverviewProjection } from "../../profile/profileOverviewProjection";
import { debugWarn } from "../../../platform/logging/logger";
import { ProjectionAPI } from "../projections.shared";
import { projectionKeys } from "../projectionKeys";
import { prefetchProjectionScreen } from "./prefetchProjection";
import type { ProjectionPrefetchSource } from "./prefetchRegistry";
import { appendProjectionRecordImageUris } from "../projectionImages.shared";
import { resolveNetworkBudget } from "../networkAwareBudget";
import { warmMediaUriCache } from "../../../shared/media/mediaUri";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import { resolveProjectionPerformanceBudget } from "../performanceBudget";
import {
  isBlockedProfile,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../social/blockedVisibility";

function normalizeValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function prefetchIntentImages(records: unknown[], maxImages = 8) {
  const networkBudget = resolveNetworkBudget();
  if (!networkBudget.allowImagePrefetch) return;
  const imageUris = new Set<string>();

  records.forEach((record) => {
    if (!record || typeof record !== "object") return;
    appendProjectionRecordImageUris(imageUris, record as Record<string, unknown>, {
      fallbackToFull: false,
      imageLimit: 1,
      includeProfile: true,
      rawFallback: false,
    });
  });

  const rawUris = Array.from(imageUris).slice(0, Math.max(0, maxImages));
  if (rawUris.length === 0) return;

  warmMediaUriCache(rawUris);
  await preloadMediaSources(rawUris, {
    allowNetworkResolve: true,
    batchSize: 1,
  });
}

function isIntentProjectionPrefetchEnabled(surface: "event-detail" | "profile" | "view-profile") {
  return resolveProjectionPerformanceBudget(surface).prefetchPolicy !== "none";
}

export async function prefetchProfileExperience(params: {
  queryClient: QueryClient;
  username: string;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const networkBudget = resolveNetworkBudget();
  if (!networkBudget.allowIntentPrefetch || !isIntentProjectionPrefetchEnabled("profile")) return;
  const targetUsername = normalizeValue(params.username);
  if (!targetUsername) return;
  if (params.viewerId) {
    const blockedVisibility = await loadViewerBlockedVisibilityOrEmpty(params.viewerId, {
      scope: "PROJECTIONS/PREFETCH",
      warningKey: "profile-prefetch-blocked-visibility-failed",
    });
    if (isBlockedProfile(blockedVisibility, { username: targetUsername })) {
      return;
    }
  }

  const overview = await params.queryClient.fetchQuery({
    queryKey: projectionKeys.profileOverview(targetUsername, params.viewerKey),
    queryFn: () =>
      getProfileOverviewProjection(
        targetUsername,
        normalizeValue(params.viewerUsername),
        params.viewerId,
      ),
    staleTime: 15_000,
  });
  void prefetchIntentImages([overview?.profile], 1).catch((error) => {
    debugWarn("PROJECTIONS/PREFETCH", "profile-intent-image-prefetch-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "profile-intent-image-prefetch-failed",
      ),
      username: targetUsername,
    });
  });
}

export async function prefetchEventExperience(params: {
  eventId: string;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
}) {
  const networkBudget = resolveNetworkBudget();
  if (!networkBudget.allowIntentPrefetch || !isIntentProjectionPrefetchEnabled("event-detail"))
    return;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) return;

  await prefetchProjectionScreen({
    entity: "event-detail",
    fetchProjection: () => ProjectionAPI.getEventDetail(eventId, params.viewerId),
    queryClient: params.queryClient,
    queryKey: projectionKeys.eventDetail(eventId, params.viewerKey),
    source: params.source || "intent",
    staleTime: 15_000,
  });
}

export async function prefetchAlbumViewExperience(params: {
  eventId: string;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
}) {
  if (!isIntentProjectionPrefetchEnabled("event-detail")) return;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) return;

  const results = await Promise.allSettled([
    prefetchEventExperience({
      eventId,
      queryClient: params.queryClient,
      source: params.source || "route",
      viewerId: params.viewerId,
      viewerKey: params.viewerKey,
    }),
    prefetchProjectionScreen({
      entity: "album-event",
      fetchProjection: () => ProjectionAPI.getAlbumEvent(eventId, { limit: 20 }, params.viewerId),
      queryClient: params.queryClient,
      queryKey: projectionKeys.albumEvent(eventId, params.viewerKey),
      source: params.source || "route",
      staleTime: 15_000,
    }),
  ]);
  results.forEach((result, index) => {
    if (result.status !== "rejected") return;
    debugWarn("PROJECTIONS/PREFETCH", "album-view-prefetch-failed", {
      eventId,
      message: String(
        (result.reason as { message?: string } | null)?.message || "album-view-prefetch-failed",
      ),
      task: index === 0 ? "event-detail" : "album-event",
    });
  });
}
