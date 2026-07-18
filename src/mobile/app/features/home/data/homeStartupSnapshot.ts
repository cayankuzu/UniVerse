import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { debugWarn } from "../../../platform/logging/logger";
import { HOME_FEED_ENTITY } from "./homeRepository";
import { STARTUP_PERFORMANCE_BUDGET } from "../../../data/projections/performanceBudget";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { noteProjectionPrefetch } from "../../../data/projections/prefetch/prefetchRegistry";
import { applyProjectionEnvelope, getProjectionState } from "../../../data/projections/projections";
import {
  filterBlockedHomeFeedItems,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../../data/social/blockedVisibility";
import { registerBlockedActorIsolationHandler } from "../../../data/social/clientIsolationRegistry";
import { collectImageVariantUris, normalizeImageVariants } from "../../../data/normalizers/media";
import { warmMediaUriCache } from "../../../shared/media/mediaUri";
import { MAX_HOME_STARTUP_PREVIEW_AGE_MS } from "../application/homeStartupPreviewPolicy";
import { prepareHomeFeedItems, type HomeFeedItem } from "./homeFeedAdapters";

const HOME_STARTUP_SNAPSHOT_STORAGE_KEY = "ogrencisosyalagi:home-startup-snapshot:v1";
const MAX_HOME_STARTUP_SNAPSHOTS = 6;
const MAX_HOME_STARTUP_ITEMS = 6;

export interface HomeStartupSnapshot {
  filterScope: string;
  items: HomeFeedItem[];
  savedAt: number;
  unreadCount: number;
  viewerKey: string;
}

const snapshotStore = new Map<string, HomeStartupSnapshot>();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let rehydratePromise: Promise<void> | null = null;

export interface HomeStartupSnapshotPrimeResult {
  primedItemCount: number;
  primedScopeCount: number;
  source: "empty-cache" | "query-cache" | "startup-snapshot";
}

function buildSnapshotKey(viewerKey: string, filterScope: string) {
  return `${String(viewerKey || "")
    .trim()
    .toLowerCase()}:${String(filterScope || "").trim()}`;
}

function buildSnapshotItemSignature(item: HomeFeedItem) {
  return String(item.rowSignature || `${item.kind}:${item.id}:${item.sortDate || ""}`).trim();
}

function buildSnapshotContentSignature(
  snapshot: Pick<HomeStartupSnapshot, "filterScope" | "items" | "unreadCount" | "viewerKey">,
) {
  return [
    snapshot.viewerKey,
    snapshot.filterScope,
    snapshot.unreadCount,
    snapshot.items.map(buildSnapshotItemSignature).join("|"),
  ].join("::");
}

function normalizeProfileValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function emitSnapshotStoreChange() {
  listeners.forEach((listener) => listener());
}

function isFreshStartupSnapshot(snapshot: HomeStartupSnapshot) {
  const savedAt = Number(snapshot.savedAt || 0);
  if (!savedAt) return false;
  return Date.now() - savedAt <= MAX_HOME_STARTUP_PREVIEW_AGE_MS;
}

function collectSnapshotImageUris(items: HomeFeedItem[]) {
  const uris = new Set<string>();
  const appendVariantUris = (
    value: unknown,
    preferredOrder: Array<"full" | "medium" | "thumbnail">,
  ) => {
    collectImageVariantUris(normalizeImageVariants(value), {
      fallbackToFull: true,
      limit: 2,
      preferredOrder,
    }).forEach((uri) => uris.add(uri));
  };
  const appendImageUris = (record: unknown) => {
    if (!record || typeof record !== "object") return;
    const imageRecord = record as Record<string, unknown>;
    appendVariantUris(imageRecord.imageVariants || imageRecord.image_variants, [
      "thumbnail",
      "medium",
      "full",
    ]);
    appendVariantUris(imageRecord.profileImageVariants || imageRecord.profile_image_variants, [
      "thumbnail",
      "medium",
      "full",
    ]);
    appendVariantUris(imageRecord.coverImageVariants || imageRecord.cover_image_variants, [
      "thumbnail",
      "medium",
      "full",
    ]);
    appendVariantUris(imageRecord.userImageVariants || imageRecord.user_image_variants, [
      "thumbnail",
      "medium",
      "full",
    ]);
    appendVariantUris(imageRecord.clubImageVariants || imageRecord.club_image_variants, [
      "thumbnail",
      "medium",
      "full",
    ]);
    [
      imageRecord.image,
      imageRecord.profileImage,
      imageRecord.profile_image_path,
      imageRecord.coverImage,
      imageRecord.cover_image_path,
      imageRecord.userImage,
      imageRecord.clubImage,
    ].forEach((value) => {
      const uri = String(value || "").trim();
      if (uri) uris.add(uri);
    });
  };

  items.slice(0, STARTUP_PERFORMANCE_BUDGET.firstFoldHomeLimit + 2).forEach((item) => {
    appendImageUris(item);
    if (item.kind === "event") {
      appendImageUris(item.event);
    } else {
      appendImageUris(item.album);
    }
  });

  return Array.from(uris).slice(0, STARTUP_PERFORMANCE_BUDGET.cachePreviewImages * 2);
}

function warmHomeStartupSnapshotImages(items: HomeFeedItem[]) {
  const nextUris = collectSnapshotImageUris(items);
  if (nextUris.length === 0) return;
  warmMediaUriCache(nextUris);
}

function commitSnapshotStoreChange(snapshotKey: string, nextSnapshot: HomeStartupSnapshot | null) {
  if (nextSnapshot) {
    snapshotStore.set(snapshotKey, nextSnapshot);
  } else {
    snapshotStore.delete(snapshotKey);
  }
  emitSnapshotStoreChange();
  schedulePersistSnapshotStore();
}

function matchesBlockedHomeFeedItem(params: {
  item: HomeFeedItem;
  targetUserId: string;
  targetUsername: string;
}) {
  if (params.item.kind === "event") {
    return (
      normalizeProfileValue(params.item.event.clubUserId) === params.targetUserId ||
      normalizeProfileValue(params.item.event.clubUsername) === params.targetUsername ||
      normalizeProfileValue(params.item.event.feedActorUsername) === params.targetUsername
    );
  }

  return (
    normalizeProfileValue(params.item.album.userId) === params.targetUserId ||
    normalizeProfileValue(params.item.album.clubUserId) === params.targetUserId ||
    normalizeProfileValue(params.item.album.username) === params.targetUsername ||
    normalizeProfileValue(params.item.album.clubUsername) === params.targetUsername
  );
}

function schedulePersistSnapshotStore() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const payload = Array.from(snapshotStore.values())
      .sort((left, right) => right.savedAt - left.savedAt)
      .slice(0, MAX_HOME_STARTUP_SNAPSHOTS);
    if (payload.length === 0) {
      void AsyncStorage.removeItem(HOME_STARTUP_SNAPSHOT_STORAGE_KEY).catch((error) => {
        debugWarn("HOME/STARTUP", "startup-snapshot-remove-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "startup-snapshot-remove-failed",
          ),
        });
      });
      return;
    }
    void AsyncStorage.setItem(HOME_STARTUP_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload)).catch(
      (error) => {
        debugWarn("HOME/STARTUP", "startup-snapshot-persist-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "startup-snapshot-persist-failed",
          ),
        });
      },
    );
  }, 120);
}

export function subscribeHomeStartupSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetHomeStartupSnapshotState() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  rehydratePromise = null;
  snapshotStore.clear();
  listeners.clear();
}

export function getHomeStartupSnapshot(viewerKey: string, filterScope: string) {
  return snapshotStore.get(buildSnapshotKey(viewerKey, filterScope)) || null;
}

export function useHomeStartupSnapshot(viewerKey: string, filterScope: string) {
  return useSyncExternalStore(
    subscribeHomeStartupSnapshot,
    () => getHomeStartupSnapshot(viewerKey, filterScope),
    () => null,
  );
}

export async function rehydrateHomeStartupSnapshots() {
  if (rehydratePromise) return rehydratePromise;
  rehydratePromise = AsyncStorage.getItem(HOME_STARTUP_SNAPSHOT_STORAGE_KEY)
    .then((rawValue) => {
      snapshotStore.clear();
      if (!rawValue) {
        emitSnapshotStoreChange();
        return;
      }
      const payload = JSON.parse(rawValue) as HomeStartupSnapshot[] | null;
      if (!Array.isArray(payload)) {
        emitSnapshotStoreChange();
        return;
      }
      payload.forEach((entry) => {
        const viewerKey = String(entry?.viewerKey || "")
          .trim()
          .toLowerCase();
        const filterScope = String(entry?.filterScope || "").trim();
        const items = Array.isArray(entry?.items) ? entry.items.filter(Boolean) : [];
        if (!viewerKey || !filterScope || items.length === 0) return;
        snapshotStore.set(buildSnapshotKey(viewerKey, filterScope), {
          filterScope,
          items: items.slice(0, MAX_HOME_STARTUP_ITEMS),
          savedAt: Number(entry?.savedAt || Date.now()),
          unreadCount: Math.max(0, Number(entry?.unreadCount || 0)),
          viewerKey,
        });
      });
      emitSnapshotStoreChange();
    })
    .catch((error) => {
      debugWarn("HOME/STARTUP", "startup-snapshot-rehydrate-failed", {
        message: String(
          (error as { message?: string } | null)?.message || "startup-snapshot-rehydrate-failed",
        ),
      });
    });
  return rehydratePromise;
}

function getFreshHomeStartupSnapshots() {
  return Array.from(snapshotStore.values())
    .filter((snapshot) => isFreshStartupSnapshot(snapshot))
    .sort((left, right) => right.savedAt - left.savedAt);
}

function seedStartupSnapshotUnreadCount(queryClient: QueryClient, snapshot: HomeStartupSnapshot) {
  const badgeKey = projectionKeys.notificationBadge(snapshot.viewerKey);
  const badgeState = queryClient.getQueryState(badgeKey);
  if ((badgeState?.dataUpdatedAt || 0) >= snapshot.savedAt) {
    return;
  }
  queryClient.setQueryData(badgeKey, {
    id: "notifications",
    unreadCount: Math.max(0, Number(snapshot.unreadCount || 0)),
  });
}

export async function primeHomeStartupSnapshotsIntoQueryCache(
  queryClient: QueryClient,
): Promise<HomeStartupSnapshotPrimeResult> {
  await rehydrateHomeStartupSnapshots();

  const freshSnapshots = getFreshHomeStartupSnapshots();
  const blockedVisibilityByViewer = new Map<
    string,
    Awaited<ReturnType<typeof loadViewerBlockedVisibilityOrEmpty>>
  >();
  const hasHomeProjectionCache = queryClient
    .getQueriesData({ queryKey: ["screen", "home"] })
    .some(([, data]) => Boolean(data));

  let primedScopeCount = 0;
  let primedItemCount = 0;

  const uniqueViewerKeys = Array.from(
    new Set(
      freshSnapshots
        .map((snapshot) => snapshot.viewerKey)
        .filter((viewerKey) => viewerKey && viewerKey !== "guest"),
    ),
  );
  await Promise.all(
    uniqueViewerKeys.map(async (viewerKey) => {
      const blockedVisibility = await loadViewerBlockedVisibilityOrEmpty(viewerKey, {
        scope: "HOME/STARTUP",
        warningKey: "startup-blocked-visibility-load-failed",
      });
      blockedVisibilityByViewer.set(viewerKey, blockedVisibility);
    }),
  );

  for (const snapshot of freshSnapshots) {
    const screenKey = projectionKeys.home(snapshot.viewerKey, snapshot.filterScope);
    const cachedState = getProjectionState(queryClient, screenKey);
    if ((cachedState?.touchedAt || 0) >= snapshot.savedAt) {
      continue;
    }

    const preparedItems = prepareHomeFeedItems(
      Array.isArray(snapshot.items) ? snapshot.items.filter(Boolean) : [],
    ).slice(0, MAX_HOME_STARTUP_ITEMS);
    if (preparedItems.length === 0) {
      continue;
    }

    let items = preparedItems;
    if (snapshot.viewerKey && snapshot.viewerKey !== "guest") {
      const blockedVisibility = blockedVisibilityByViewer.get(snapshot.viewerKey);
      if (blockedVisibility) {
        items = filterBlockedHomeFeedItems(preparedItems, blockedVisibility).slice(
          0,
          MAX_HOME_STARTUP_ITEMS,
        );
        if (items.length !== preparedItems.length) {
          commitSnapshotStoreChange(
            buildSnapshotKey(snapshot.viewerKey, snapshot.filterScope),
            items.length > 0
              ? {
                  ...snapshot,
                  items,
                }
              : null,
          );
        }
      }
    }

    if (items.length === 0) {
      continue;
    }

    const primedState = applyProjectionEnvelope({
      entity: HOME_FEED_ENTITY,
      envelope: {
        deletedIds: [],
        deltaToken: null,
        items,
        nextCursor: null,
        serverTime: new Date(snapshot.savedAt).toISOString(),
        updatedItems: [],
      },
      mode: "replace",
      queryClient,
      screenKey,
    });
    if (primedState) {
      queryClient.setQueryData(screenKey, {
        ...primedState,
        forceRefreshMode: "replace" as const,
        isStale: true,
      });
    }
    noteProjectionPrefetch({
      queryKey: screenKey,
      source: "warmup",
      status: "cache-hit",
    });
    seedStartupSnapshotUnreadCount(queryClient, snapshot);
    warmHomeStartupSnapshotImages(items);
    primedScopeCount += 1;
    primedItemCount += items.length;
  }

  return {
    primedItemCount,
    primedScopeCount,
    source:
      primedScopeCount > 0
        ? "startup-snapshot"
        : hasHomeProjectionCache
          ? "query-cache"
          : "empty-cache",
  };
}

export function removeBlockedActorFromHomeStartupSnapshots(params: {
  targetUserId?: string | null;
  targetUsername?: string | null;
  viewerKey: string;
}) {
  const viewerKey = normalizeProfileValue(params.viewerKey);
  const targetUserId = normalizeProfileValue(params.targetUserId);
  const targetUsername = normalizeProfileValue(params.targetUsername);
  if (!viewerKey || (!targetUserId && !targetUsername)) return;

  snapshotStore.forEach((snapshot, snapshotKey) => {
    if (normalizeProfileValue(snapshot.viewerKey) !== viewerKey) return;
    const nextItems = snapshot.items.filter(
      (item) =>
        !matchesBlockedHomeFeedItem({
          item,
          targetUserId,
          targetUsername,
        }),
    );
    if (nextItems.length === snapshot.items.length) return;
    commitSnapshotStoreChange(
      snapshotKey,
      nextItems.length > 0
        ? {
            ...snapshot,
            items: nextItems,
          }
        : null,
    );
  });
}

export function persistHomeStartupSnapshot(snapshot: HomeStartupSnapshot) {
  const viewerKey = String(snapshot.viewerKey || "")
    .trim()
    .toLowerCase();
  const filterScope = String(snapshot.filterScope || "").trim();
  const items = prepareHomeFeedItems(
    Array.isArray(snapshot.items) ? snapshot.items.filter(Boolean) : [],
  );
  if (!viewerKey || !filterScope || items.length === 0) return;
  const snapshotKey = buildSnapshotKey(viewerKey, filterScope);
  const nextSnapshot = {
    filterScope,
    items: items.slice(0, MAX_HOME_STARTUP_ITEMS),
    savedAt: Number(snapshot.savedAt || Date.now()),
    unreadCount: Math.max(0, Number(snapshot.unreadCount || 0)),
    viewerKey,
  } satisfies HomeStartupSnapshot;
  const currentSnapshot = snapshotStore.get(snapshotKey);
  if (
    currentSnapshot &&
    buildSnapshotContentSignature(currentSnapshot) === buildSnapshotContentSignature(nextSnapshot)
  ) {
    if (Number(currentSnapshot.savedAt || 0) >= nextSnapshot.savedAt) {
      return;
    }
    snapshotStore.set(snapshotKey, nextSnapshot);
    schedulePersistSnapshotStore();
    return;
  }
  snapshotStore.set(snapshotKey, nextSnapshot);
  warmHomeStartupSnapshotImages(nextSnapshot.items);
  emitSnapshotStoreChange();
  schedulePersistSnapshotStore();
}

registerBlockedActorIsolationHandler(removeBlockedActorFromHomeStartupSnapshots);
