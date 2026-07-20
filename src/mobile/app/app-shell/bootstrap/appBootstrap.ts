import { onlineManager } from "@tanstack/react-query";
import { LogBox } from "react-native";
import {
  getNetworkQuality,
  initNetworkBudgetListener,
  subscribeNetworkQuality,
  type NetworkQuality,
} from "../../data/projections/networkAwareBudget";
import { queryClient } from "../../data/query/queryClient";
import { rehydrateHomeStartupSnapshots } from "../../features/home/public/warmup";
import {
  getSignedMediaUrl,
  getSignedMediaUrls,
  SIGNED_MEDIA_URL_CACHE_TTL_MS,
} from "../../platform/media/getSignedMediaUrl";
import { configureMediaUrlResolver } from "../../shared/media/mediaUrlResolver";
import { rehydratePersistedMediaUriCache } from "../../shared/media/mediaUri";

let appBootstrapInitialized = false;
let cacheHydrationPromise: Promise<void> | null = null;
let lastKnownOnline = getNetworkQuality() !== "offline";
let networkQualityUnsubscribe: (() => void) | null = null;
const APP_BOOTSTRAP_IGNORED_LOGS = [
  "SafeAreaView has been deprecated and will be removed in a future release.",
  "Please use 'react-native-safe-area-context' instead. See https://github.com/AppAndFlow/react-native-safe-area-context",
];

function isOnlineQuality(quality: NetworkQuality) {
  return quality !== "offline";
}

function syncReactQueryOnlineState(quality: NetworkQuality) {
  const online = isOnlineQuality(quality);
  onlineManager.setOnline(online);

  if (online && !lastKnownOnline) {
    void queryClient.resumePausedMutations();
    void queryClient.refetchQueries({ stale: true, type: "active" });
  }

  lastKnownOnline = online;
}

export function hydrateStartupCaches() {
  cacheHydrationPromise ??= Promise.all([
    rehydrateHomeStartupSnapshots(),
    rehydratePersistedMediaUriCache(),
  ]).then(() => undefined);
  return cacheHydrationPromise;
}

function initializeBootstrapServices() {
  initNetworkBudgetListener();
  syncReactQueryOnlineState(getNetworkQuality());
  networkQualityUnsubscribe ??= subscribeNetworkQuality(syncReactQueryOnlineState);
  configureMediaUrlResolver({
    cacheTtlMs: SIGNED_MEDIA_URL_CACHE_TTL_MS,
    resolveMediaUrl: getSignedMediaUrl,
    resolveMediaUrls: getSignedMediaUrls,
  });
  return hydrateStartupCaches();
}

export function initializeAppBootstrap() {
  if (appBootstrapInitialized) return hydrateStartupCaches();
  appBootstrapInitialized = true;

  LogBox.ignoreLogs(APP_BOOTSTRAP_IGNORED_LOGS);
  return initializeBootstrapServices();
}
