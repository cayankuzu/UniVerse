type ResolveMediaUrl = (objectPath: string) => Promise<string>;
type ResolveMediaUrls = (objectPaths: string[]) => Promise<Record<string, string>>;

const defaultResolveMediaUrl: ResolveMediaUrl = async () => "";
const defaultResolveMediaUrls: ResolveMediaUrls = async () => ({});
const DEFAULT_MEDIA_URL_CACHE_TTL_MS = 9 * 60 * 1000;

let resolveMediaUrlImpl: ResolveMediaUrl = defaultResolveMediaUrl;
let resolveMediaUrlsImpl: ResolveMediaUrls = defaultResolveMediaUrls;
let mediaUrlCacheTtlMs = DEFAULT_MEDIA_URL_CACHE_TTL_MS;

export function configureMediaUrlResolver(params: {
  cacheTtlMs?: number;
  resolveMediaUrl?: ResolveMediaUrl;
  resolveMediaUrls?: ResolveMediaUrls;
}) {
  resolveMediaUrlImpl = params.resolveMediaUrl || defaultResolveMediaUrl;
  resolveMediaUrlsImpl = params.resolveMediaUrls || defaultResolveMediaUrls;
  const requestedCacheTtlMs = Number(params.cacheTtlMs);
  mediaUrlCacheTtlMs =
    Number.isFinite(requestedCacheTtlMs) && requestedCacheTtlMs > 0
      ? requestedCacheTtlMs
      : DEFAULT_MEDIA_URL_CACHE_TTL_MS;
}

export function resetMediaUrlResolver() {
  resolveMediaUrlImpl = defaultResolveMediaUrl;
  resolveMediaUrlsImpl = defaultResolveMediaUrls;
  mediaUrlCacheTtlMs = DEFAULT_MEDIA_URL_CACHE_TTL_MS;
}

export function getMediaUrlCacheTtlMs() {
  return mediaUrlCacheTtlMs;
}

export function resolveSignedMediaUrl(objectPath: string) {
  return resolveMediaUrlImpl(String(objectPath || "").trim());
}

export function resolveSignedMediaUrls(objectPaths: string[]) {
  return resolveMediaUrlsImpl(objectPaths);
}
