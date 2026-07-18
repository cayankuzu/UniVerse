import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMediaUrlCacheTtlMs,
  resolveSignedMediaUrl,
  resolveSignedMediaUrls,
} from "./mediaUrlResolver";

const MANAGED_STORAGE_BUCKET = "make-e3557d40-media";
export const MEDIA_URI_CACHE_PERSIST_KEY = "ogrencisosyalagi:media-uri-cache:v1";
const MAX_PERSISTED_MEDIA_URI_ENTRIES = 800;
const MAX_WARM_MEDIA_URIS_PER_RUN = 16;
const resolvedUriCache = new Map<string, { expiresAt: number; url: string }>();
const inflightUriCache = new Map<string, Promise<string>>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let rehydratePromise: Promise<void> | null = null;

export function normalizeMediaUriInput(value: string | null | undefined) {
  return String(value || "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MANAGED_STORAGE_URL_PATTERN = new RegExp(
  `/storage/v1/(?:render/image|object)/(?:public|authenticated|sign)/${escapeRegExp(MANAGED_STORAGE_BUCKET)}/([^?#]+)`,
  "i",
);
const MANAGED_STORAGE_ROUTE_PATTERN = new RegExp(
  `(?:^|/)storage/v1/(?:render/image|object)/(?:public|authenticated|sign)/${escapeRegExp(MANAGED_STORAGE_BUCKET)}/([^?#]+)`,
  "i",
);

function decodeManagedStoragePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripManagedStorageBucketPrefix(uri: string) {
  const normalizedUri = normalizeMediaUriInput(uri).replace(/^\/+/, "");
  if (!normalizedUri) return "";

  const lowerBucketPrefix = `${MANAGED_STORAGE_BUCKET.toLowerCase()}/`;
  if (normalizedUri.toLowerCase().startsWith(lowerBucketPrefix)) {
    return decodeManagedStoragePath(normalizedUri.slice(lowerBucketPrefix.length));
  }

  const routeMatch = normalizedUri.match(MANAGED_STORAGE_ROUTE_PATTERN);
  if (routeMatch?.[1]) {
    return decodeManagedStoragePath(routeMatch[1]);
  }

  return "";
}

function isManagedStorageUri(uri: string) {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return false;
  if (stripManagedStorageBucketPrefix(normalizedUri)) return true;
  return (
    MANAGED_STORAGE_ROUTE_PATTERN.test(normalizedUri) ||
    MANAGED_STORAGE_URL_PATTERN.test(normalizedUri)
  );
}

function isDirectManagedStorageUri(uri: string) {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return false;

  const isPublicRoute = new RegExp(
    `/storage/v1/(?:render/image|object)/public/${escapeRegExp(MANAGED_STORAGE_BUCKET)}/`,
    "i",
  ).test(normalizedUri);
  if (isPublicRoute) return true;

  const isSignedRoute = new RegExp(
    `/storage/v1/(?:render/image|object)/sign/${escapeRegExp(MANAGED_STORAGE_BUCKET)}/`,
    "i",
  ).test(normalizedUri);
  return isSignedRoute && /(?:[?&]token=)/i.test(normalizedUri);
}

function schedulePersistResolvedUriCache() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const now = Date.now();
    const payload = Array.from(resolvedUriCache.entries())
      .map(([cacheKey, entry]) => ({
        cacheKey,
        expiresAt: Number(entry.expiresAt || 0),
        url: normalizeMediaUriInput(entry.url),
      }))
      .filter((entry) => entry.cacheKey && entry.url && entry.expiresAt > now)
      .sort((left, right) => right.expiresAt - left.expiresAt)
      .slice(0, MAX_PERSISTED_MEDIA_URI_ENTRIES);

    if (payload.length === 0) {
      void AsyncStorage.removeItem(MEDIA_URI_CACHE_PERSIST_KEY).catch(() => undefined);
      return;
    }

    void AsyncStorage.setItem(MEDIA_URI_CACHE_PERSIST_KEY, JSON.stringify(payload)).catch(
      () => undefined,
    );
  }, 120);
}

function cacheResolvedMediaUri(cacheKey: string, url: string) {
  const normalizedUrl = normalizeMediaUriInput(url);
  if (!cacheKey || !normalizedUrl) return normalizedUrl;
  resolvedUriCache.set(cacheKey, {
    expiresAt: Date.now() + getMediaUrlCacheTtlMs(),
    url: normalizedUrl,
  });
  schedulePersistResolvedUriCache();
  return normalizedUrl;
}

export function extractManagedStoragePath(uri: string) {
  const normalizedUri = normalizeMediaUriInput(uri);
  const normalizedRawPath = stripManagedStorageBucketPrefix(normalizedUri);
  if (normalizedRawPath) {
    return normalizedRawPath;
  }
  if (!/^https?:/i.test(normalizedUri)) return "";

  const regexMatch = normalizedUri.match(MANAGED_STORAGE_URL_PATTERN);
  if (regexMatch?.[1]) {
    return decodeManagedStoragePath(regexMatch[1]);
  }

  try {
    const sourceUrl = new URL(normalizedUri);
    const segments = sourceUrl.pathname.split("/").filter(Boolean);
    const bucketIndex = segments.findIndex((segment) => segment === MANAGED_STORAGE_BUCKET);
    if (bucketIndex < 0) return "";
    const storagePrefix = segments.slice(0, bucketIndex).join("/");
    if (!storagePrefix.startsWith("storage/v1/")) return "";

    return decodeManagedStoragePath(segments.slice(bucketIndex + 1).join("/"));
  } catch {
    return "";
  }
}

export function canUseMediaUriDirectly(uri: string) {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return false;
  if (/^(file:|content:|asset:|data:|blob:|ph:)/i.test(normalizedUri)) {
    return true;
  }
  if (!/^https?:/i.test(normalizedUri)) {
    return false;
  }
  if (!isManagedStorageUri(normalizedUri)) {
    return true;
  }
  return isDirectManagedStorageUri(normalizedUri);
}

export function getMediaUriCacheKey(uri: string | null | undefined) {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return "";
  return extractManagedStoragePath(normalizedUri) || normalizedUri;
}

export function getCachedResolvedMediaUri(uri: string | null | undefined) {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return "";
  if (canUseMediaUriDirectly(normalizedUri)) return normalizedUri;

  const cacheKey = getMediaUriCacheKey(normalizedUri);
  const cached = resolvedUriCache.get(cacheKey);
  if (!cached) return "";
  if (cached.expiresAt <= Date.now()) {
    resolvedUriCache.delete(cacheKey);
    return "";
  }
  return cached.url;
}

export function getPrefetchableMediaUris(uris: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      uris
        .map((uri) => getCachedResolvedMediaUri(uri))
        .map((uri) => normalizeMediaUriInput(uri))
        .filter(Boolean),
    ),
  );
}

export interface ResolvedMediaSource {
  cacheKey: string;
  uri: string;
}

interface ResolveMediaOptions {
  allowNetworkResolve?: boolean;
}

export async function rehydratePersistedMediaUriCache() {
  if (rehydratePromise) return rehydratePromise;

  rehydratePromise = AsyncStorage.getItem(MEDIA_URI_CACHE_PERSIST_KEY)
    .then((rawValue) => {
      if (!rawValue) return;
      const payload = JSON.parse(rawValue) as Array<{
        cacheKey?: string;
        expiresAt?: number;
        url?: string;
      }> | null;
      if (!Array.isArray(payload)) return;
      const now = Date.now();
      payload.forEach((entry) => {
        const cacheKey = normalizeMediaUriInput(entry?.cacheKey);
        const url = normalizeMediaUriInput(entry?.url);
        const expiresAt = Number(entry?.expiresAt || 0);
        if (!cacheKey || !url || !Number.isFinite(expiresAt) || expiresAt <= now) {
          return;
        }
        resolvedUriCache.set(cacheKey, { expiresAt, url });
      });
    })
    .catch(() => undefined);

  return rehydratePromise;
}

export async function clearPersistedMediaUriCache() {
  resolvedUriCache.clear();
  inflightUriCache.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  rehydratePromise = null;
  await AsyncStorage.removeItem(MEDIA_URI_CACHE_PERSIST_KEY).catch(() => undefined);
}

export async function resolveMediaUri(uri: string | null | undefined): Promise<string> {
  const normalizedUri = normalizeMediaUriInput(uri);
  if (!normalizedUri) return "";
  if (canUseMediaUriDirectly(normalizedUri)) return normalizedUri;
  await rehydratePersistedMediaUriCache();

  const cacheKey = getMediaUriCacheKey(normalizedUri);
  const cached = resolvedUriCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (cached && cached.expiresAt <= Date.now()) {
    resolvedUriCache.delete(cacheKey);
  }

  let pending = inflightUriCache.get(cacheKey);
  if (!pending) {
    pending = resolveSignedMediaUrl(cacheKey)
      .then((url) => cacheResolvedMediaUri(cacheKey, url))
      .catch(() => "")
      .finally(() => {
        inflightUriCache.delete(cacheKey);
      });
    inflightUriCache.set(cacheKey, pending);
  }

  return pending;
}

export async function resolveMediaUris(
  uris: Array<string | null | undefined>,
  options?: ResolveMediaOptions,
) {
  const sources = await resolveMediaSources(uris, options);
  return sources.map((source) => source.uri);
}

export async function resolveMediaSources(
  uris: Array<string | null | undefined>,
  options?: ResolveMediaOptions,
) {
  const uniqueUris = Array.from(
    new Set(uris.map((uri) => normalizeMediaUriInput(uri)).filter(Boolean)),
  );
  if (uniqueUris.length === 0) return [] as ResolvedMediaSource[];
  if (uniqueUris.some((uri) => !canUseMediaUriDirectly(uri))) {
    await rehydratePersistedMediaUriCache();
  }

  const allowNetworkResolve = options?.allowNetworkResolve !== false;
  const results = new Map<string, string>();
  const pendingPromises: Promise<ResolvedMediaSource | null>[] = [];
  const batchCacheKeys = new Set<string>();

  uniqueUris.forEach((uri) => {
    const cacheKey = getMediaUriCacheKey(uri);
    if (!cacheKey) return;

    if (canUseMediaUriDirectly(uri)) {
      results.set(cacheKey, uri);
      return;
    }

    const cached = getCachedResolvedMediaUri(uri);
    if (cached) {
      results.set(cacheKey, cached);
      return;
    }

    const pending = inflightUriCache.get(cacheKey);
    if (pending) {
      pendingPromises.push(
        pending.then((resolvedUri) => {
          const normalizedResolvedUri = normalizeMediaUriInput(resolvedUri);
          return normalizedResolvedUri ? { cacheKey, uri: normalizedResolvedUri } : null;
        }),
      );
      return;
    }

    if (!allowNetworkResolve) {
      return;
    }

    batchCacheKeys.add(cacheKey);
  });

  if (allowNetworkResolve && batchCacheKeys.size > 0) {
    const keysToResolve = Array.from(batchCacheKeys);
    const batchPromise = resolveSignedMediaUrls(keysToResolve).catch(
      () => ({}) as Record<string, string>,
    );

    keysToResolve.forEach((cacheKey) => {
      const pending = batchPromise
        .then((signedUrls) => cacheResolvedMediaUri(cacheKey, signedUrls[cacheKey] || ""))
        .finally(() => {
          inflightUriCache.delete(cacheKey);
        });
      inflightUriCache.set(cacheKey, pending);
      pendingPromises.push(
        pending.then((resolvedUri) => {
          const normalizedResolvedUri = normalizeMediaUriInput(resolvedUri);
          return normalizedResolvedUri ? { cacheKey, uri: normalizedResolvedUri } : null;
        }),
      );
    });
  }

  if (pendingPromises.length > 0) {
    const resolved = await Promise.all(pendingPromises);
    resolved.forEach((entry) => {
      if (!entry?.cacheKey || !entry.uri) return;
      results.set(entry.cacheKey, entry.uri);
    });
  }

  return Array.from(results.entries()).map(([cacheKey, uri]) => ({
    cacheKey,
    uri,
  }));
}

export function warmMediaUriCache(uris: Array<string | null | undefined>) {
  const unique = Array.from(new Set(uris.map((u) => normalizeMediaUriInput(u)).filter(Boolean)))
    .filter((u) => !getCachedResolvedMediaUri(u))
    .slice(0, MAX_WARM_MEDIA_URIS_PER_RUN);
  if (unique.length === 0) return;
  void resolveMediaUris(unique, { allowNetworkResolve: true });
}
