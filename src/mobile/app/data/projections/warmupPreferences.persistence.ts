import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugWarn } from "../../platform/logging/logger";
import type {
  HomeProjectionParams,
  ProfileContentTab,
  SearchProjectionParams,
} from "./projections.types";
import {
  buildHomeScopeKey,
  buildLandingAffinityKey,
  buildPersistedHomeScope,
  buildPersistedSearchScope,
  buildProfileTabKey,
  buildSearchScopeKey,
  clearCachedWarmupPreferences,
  createEmptyPersistedWarmupPreferences,
  deleteCachedWarmupPreferences,
  hasCachedWarmupPreferences,
  mergeCachedWarmupPreferences,
  normalizeViewerKey,
  parseHomeScope,
  parseProfileTab,
  parseSearchScope,
  readCachedWarmupPreferences,
  type PersistedWarmupPreferences,
  writeCachedWarmupPreferences,
} from "./warmupPreferences.shared";
import {
  parseLandingAffinity,
  recordLandingAffinityVisit,
  type WarmupLandingSurface,
} from "./warmupLandingAffinity";

const warmupPreferencesLoadPromises = new Map<string, Promise<PersistedWarmupPreferences>>();
const warmupLandingWritePromises = new Map<string, Promise<void>>();
let warmupPreferencesGeneration = 0;

export function loadPersistedWarmupPreferences(
  viewerKey: string,
): Promise<PersistedWarmupPreferences> {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) {
    return Promise.resolve(createEmptyPersistedWarmupPreferences());
  }

  if (hasCachedWarmupPreferences(normalizedViewerKey)) {
    return Promise.resolve(readCachedWarmupPreferences(normalizedViewerKey));
  }

  const inflightLoad = warmupPreferencesLoadPromises.get(normalizedViewerKey);
  if (inflightLoad) return inflightLoad;

  const loadGeneration = warmupPreferencesGeneration;
  const loadPromise: Promise<PersistedWarmupPreferences> = AsyncStorage.multiGet([
    buildHomeScopeKey(normalizedViewerKey),
    buildLandingAffinityKey(normalizedViewerKey),
    buildProfileTabKey(normalizedViewerKey),
    buildSearchScopeKey(normalizedViewerKey),
  ])
    .then((entries) => {
      const values = new Map(entries);
      const nextPreferences = {
        landingAffinity: parseLandingAffinity(
          values.get(buildLandingAffinityKey(normalizedViewerKey)),
        ),
        lastHomeScope: parseHomeScope(values.get(buildHomeScopeKey(normalizedViewerKey))),
        lastProfileTab: parseProfileTab(values.get(buildProfileTabKey(normalizedViewerKey))),
        lastSearchScope: parseSearchScope(values.get(buildSearchScopeKey(normalizedViewerKey))),
      };
      if (loadGeneration === warmupPreferencesGeneration) {
        writeCachedWarmupPreferences(normalizedViewerKey, nextPreferences);
      }
      return nextPreferences;
    })
    .finally(() => {
      if (warmupPreferencesLoadPromises.get(normalizedViewerKey) === loadPromise) {
        warmupPreferencesLoadPromises.delete(normalizedViewerKey);
      }
    });
  warmupPreferencesLoadPromises.set(normalizedViewerKey, loadPromise);
  return loadPromise;
}

export function getCachedWarmupPreferences(viewerKey: string): PersistedWarmupPreferences {
  return readCachedWarmupPreferences(viewerKey);
}

export function persistWarmupLandingVisit(viewerKey: string, surface: WarmupLandingSurface) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) return Promise.resolve();
  const writeGeneration = warmupPreferencesGeneration;
  const previousWrite = warmupLandingWritePromises.get(normalizedViewerKey) || Promise.resolve();
  const writePromise: Promise<void> = previousWrite
    .catch(() => undefined)
    .then(async () => {
      const preferences = await loadPersistedWarmupPreferences(normalizedViewerKey);
      if (writeGeneration !== warmupPreferencesGeneration) return;
      const payload = recordLandingAffinityVisit(preferences.landingAffinity, surface);
      mergeCachedWarmupPreferences(normalizedViewerKey, { landingAffinity: payload });
      await AsyncStorage.setItem(
        buildLandingAffinityKey(normalizedViewerKey),
        JSON.stringify(payload),
      );
    })
    .finally(() => {
      if (warmupLandingWritePromises.get(normalizedViewerKey) === writePromise) {
        warmupLandingWritePromises.delete(normalizedViewerKey);
      }
    });
  warmupLandingWritePromises.set(normalizedViewerKey, writePromise);
  return writePromise;
}

export async function persistWarmupHomeScope(
  viewerKey: string,
  params: {
    entityFilter?: HomeProjectionParams["entityFilter"];
    scope: string;
    sortOption?: HomeProjectionParams["sortOption"];
    sourceFilter?: HomeProjectionParams["sourceFilter"];
    typeFilter?: HomeProjectionParams["typeFilter"];
  },
) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  const payload = buildPersistedHomeScope(params);
  if (!normalizedViewerKey || !payload) return;
  mergeCachedWarmupPreferences(normalizedViewerKey, { lastHomeScope: payload });
  await AsyncStorage.setItem(buildHomeScopeKey(normalizedViewerKey), JSON.stringify(payload));
}

export async function persistWarmupProfileTab(viewerKey: string, tab: ProfileContentTab) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) return;
  mergeCachedWarmupPreferences(normalizedViewerKey, { lastProfileTab: tab });
  await AsyncStorage.setItem(buildProfileTabKey(normalizedViewerKey), tab);
}

export async function persistWarmupSearchScope(
  viewerKey: string,
  params: {
    categoryFilter?: string;
    feeFilter?: SearchProjectionParams["feeFilter"];
    kind: SearchProjectionParams["kind"];
    queryText?: string;
    scope: string;
    sortMode?: string;
    universityFilter?: string;
  },
) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  const payload = buildPersistedSearchScope(params);
  if (!normalizedViewerKey || !payload) return;
  mergeCachedWarmupPreferences(normalizedViewerKey, { lastSearchScope: payload });
  await AsyncStorage.setItem(buildSearchScopeKey(normalizedViewerKey), JSON.stringify(payload));
}

export async function clearPersistedWarmupPreferences(viewerKey?: string) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey || "");
  const pendingLandingWrites = normalizedViewerKey
    ? [warmupLandingWritePromises.get(normalizedViewerKey)].filter(
        (promise): promise is Promise<void> => Boolean(promise),
      )
    : Array.from(warmupLandingWritePromises.values());
  warmupPreferencesGeneration += 1;
  if (normalizedViewerKey) {
    warmupPreferencesLoadPromises.delete(normalizedViewerKey);
    warmupLandingWritePromises.delete(normalizedViewerKey);
    deleteCachedWarmupPreferences(normalizedViewerKey);
    await Promise.allSettled(pendingLandingWrites);
    await AsyncStorage.multiRemove([
      buildHomeScopeKey(normalizedViewerKey),
      buildLandingAffinityKey(normalizedViewerKey),
      buildProfileTabKey(normalizedViewerKey),
      buildSearchScopeKey(normalizedViewerKey),
    ]);
    return;
  }

  warmupPreferencesLoadPromises.clear();
  warmupLandingWritePromises.clear();
  clearCachedWarmupPreferences();
  await Promise.allSettled(pendingLandingWrites);
  const keys = await AsyncStorage.getAllKeys().catch((error) => {
    debugWarn("PROJECTIONS/WARMUP", "warmup-preferences-list-keys-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "warmup-preferences-list-keys-failed",
      ),
    });
    return [] as string[];
  });
  const removableKeys = keys.filter(
    (key) =>
      key.startsWith("warmup:last-home-scope:v1:") ||
      key.startsWith("warmup:landing-affinity:v1:") ||
      key.startsWith("warmup:last-profile-tab:v1:") ||
      key.startsWith("warmup:last-search-scope:v1:"),
  );
  if (removableKeys.length > 0) {
    await AsyncStorage.multiRemove(removableKeys);
  }
}
