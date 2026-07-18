import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from "../config/publicEnv";
import { startObservedTimer } from "../observability";
import { supabase } from "../supabase";
import { refreshSupabaseSessionSingleFlight } from "../supabase/sessionRefresh";

const STORAGE_BUCKET = "make-e3557d40-media";
// 2 hours - long enough to prevent churn between normal navigations while
// keeping signed URLs bounded in lifetime.
const STORAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;
const SIGNED_URL_EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;
export const SIGNED_MEDIA_URL_CACHE_TTL_MS =
  STORAGE_SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_EXPIRY_SAFETY_WINDOW_MS;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;
const SESSION_FALLBACK_TTL_MS = 5 * 60 * 1000;
const SIGNED_URL_BATCH_WINDOW_MS = 24;

let cachedAccessToken: {
  expiresAt: number;
  token: string;
} | null = null;
let inflightAccessTokenPromise: Promise<string | null> | null = null;
let pendingSignedUrlBatchTimer: ReturnType<typeof setTimeout> | null = null;
type SignedUrlRow = {
  error?: string | null;
  path?: string | null;
  signedURL?: string | null;
  signedUrl?: string | null;
};
type PendingSignedUrlRequest = {
  objectPaths: string[];
  reject: (error: unknown) => void;
  resolve: (value: Record<string, string>) => void;
};
const pendingSignedUrlRequests: PendingSignedUrlRequest[] = [];

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeObjectPath(value: unknown) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return "";

  const bucketPrefixedValue = normalizedValue.replace(/^\/+/, "");
  const lowerBucketPrefix = `${STORAGE_BUCKET.toLowerCase()}/`;
  if (bucketPrefixedValue.toLowerCase().startsWith(lowerBucketPrefix)) {
    return bucketPrefixedValue.slice(lowerBucketPrefix.length);
  }

  const routeMatch = bucketPrefixedValue.match(
    new RegExp(
      `(?:^|/)storage/v1/(?:render/image|object)/(?:public|authenticated|sign)/${STORAGE_BUCKET}/([^?#]+)`,
      "i",
    ),
  );
  if (routeMatch?.[1]) {
    try {
      return decodeURIComponent(routeMatch[1]);
    } catch {
      return routeMatch[1];
    }
  }

  return normalizedValue;
}

function buildAbsoluteSignedUrl(signedPath: string) {
  const normalizedSignedPath = normalizeText(signedPath);
  if (!normalizedSignedPath) return "";
  if (/^https?:/i.test(normalizedSignedPath)) return normalizedSignedPath;
  return `${SUPABASE_PUBLIC_URL}/storage/v1${
    normalizedSignedPath.startsWith("/") ? normalizedSignedPath : `/${normalizedSignedPath}`
  }`;
}

function cacheAccessToken(
  session: { access_token?: string | null; expires_at?: number | null } | null,
) {
  const token = normalizeText(session?.access_token);
  if (!token) {
    cachedAccessToken = null;
    return null;
  }

  const expiresAtSeconds = Number(session?.expires_at || 0);
  const expiresAt =
    Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
      ? expiresAtSeconds * 1000
      : Date.now() + SESSION_FALLBACK_TTL_MS;
  cachedAccessToken = {
    expiresAt,
    token,
  };
  return token;
}

async function getCurrentSession() {
  const sessionResult = await supabase.auth.getSession().catch(() => null);
  const activeSession = sessionResult?.data.session || null;
  if (activeSession?.access_token) {
    return activeSession;
  }

  const refreshResult = await refreshSupabaseSessionSingleFlight().catch(() => null);
  return refreshResult?.data.session || null;
}

async function getCurrentAccessToken() {
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS > Date.now()
  ) {
    return cachedAccessToken.token;
  }

  if (!inflightAccessTokenPromise) {
    inflightAccessTokenPromise = getCurrentSession()
      .then((session) => cacheAccessToken(session))
      .finally(() => {
        inflightAccessTokenPromise = null;
      });
  }

  return inflightAccessTokenPromise;
}

function normalizeObjectPaths(objectPaths: string[]) {
  return Array.from(new Set(objectPaths.map((path) => normalizeObjectPath(path)).filter(Boolean)));
}

function mapSignedUrlRows(rows: SignedUrlRow[] | null | undefined) {
  const signedUrls: Record<string, string> = {};
  if (!Array.isArray(rows)) return signedUrls;

  rows.forEach((row) => {
    const path = normalizeText(row.path);
    const signedUrl = buildAbsoluteSignedUrl(String(row.signedUrl || row.signedURL || ""));
    if (!path || !signedUrl || row.error) return;
    signedUrls[path] = signedUrl;
  });

  return signedUrls;
}

async function getSignedUrlsWithClient(objectPaths: string[], accessToken: string | null) {
  if (!accessToken || objectPaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(objectPaths, STORAGE_SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return {};
  }

  return mapSignedUrlRows(data);
}

async function getSignedUrlsWithRest(objectPaths: string[], accessToken: string | null) {
  if (!accessToken || objectPaths.length === 0) return {};

  const response = await fetch(`${SUPABASE_PUBLIC_URL}/storage/v1/object/sign/${STORAGE_BUCKET}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
      paths: objectPaths,
    }),
  }).catch(() => null);

  if (!response?.ok) return {};

  const payload = (await response.json().catch(() => null)) as SignedUrlRow[] | null;

  return mapSignedUrlRows(payload);
}

async function resolveSignedMediaUrlBatch(objectPaths: string[], accessToken: string | null) {
  const signedWithClient = await getSignedUrlsWithClient(objectPaths, accessToken);
  const missingPaths = objectPaths.filter((path) => !signedWithClient[path]);
  if (missingPaths.length === 0) {
    return {
      merged: signedWithClient,
      restResolvedCount: 0,
      source: "client" as const,
    };
  }

  const signedWithRest = await getSignedUrlsWithRest(missingPaths, accessToken);
  return {
    merged: {
      ...signedWithClient,
      ...signedWithRest,
    },
    restResolvedCount: Object.keys(signedWithRest).length,
    source:
      Object.keys(signedWithRest).length > 0
        ? ("mixed" as const)
        : ("client-only-partial" as const),
  };
}

function resolveSignedUrlBatchForRequests(
  requests: PendingSignedUrlRequest[],
  signedUrls: Record<string, string>,
) {
  requests.forEach((request) => {
    const scopedUrls: Record<string, string> = {};
    request.objectPaths.forEach((path) => {
      if (signedUrls[path]) {
        scopedUrls[path] = signedUrls[path];
      }
    });
    request.resolve(scopedUrls);
  });
}

function dequeueSignedUrlBatchRequests() {
  return pendingSignedUrlRequests.splice(0, pendingSignedUrlRequests.length);
}

async function flushSignedMediaUrlBatch() {
  const requests = dequeueSignedUrlBatchRequests();
  if (requests.length === 0) return;
  const normalizedPaths = normalizeObjectPaths(requests.flatMap((request) => request.objectPaths));
  if (normalizedPaths.length === 0) {
    resolveSignedUrlBatchForRequests(requests, {});
    return;
  }
  const stopSignedUrlTelemetry = startObservedTimer({
    category: "projection",
    meta: {
      pathCount: normalizedPaths.length,
      requestCount: requests.length,
    },
    name: "media:signed_url_resolve",
    screenKey: "media:signed-url",
  });
  try {
    const accessToken = await getCurrentAccessToken();
    if (!accessToken) {
      stopSignedUrlTelemetry("skipped", {
        reason: "missing-access-token",
        resolvedCount: 0,
      });
      resolveSignedUrlBatchForRequests(requests, {});
      return;
    }

    const { merged, restResolvedCount, source } = await resolveSignedMediaUrlBatch(
      normalizedPaths,
      accessToken,
    );
    const clientResolvedCount = Math.max(0, Object.keys(merged).length - restResolvedCount);
    stopSignedUrlTelemetry(Object.keys(merged).length > 0 ? "ok" : "skipped", {
      clientResolvedCount,
      pathCount: normalizedPaths.length,
      requestCount: requests.length,
      resolvedCount: Object.keys(merged).length,
      restResolvedCount,
      source,
    });
    resolveSignedUrlBatchForRequests(requests, merged);
  } catch (error) {
    stopSignedUrlTelemetry("error", {
      message: String((error as { message?: string } | null)?.message || error || ""),
    });
    requests.forEach((request) => request.reject(error));
  }
}

function scheduleSignedMediaUrlBatchFlush() {
  if (pendingSignedUrlBatchTimer) return;
  pendingSignedUrlBatchTimer = setTimeout(() => {
    pendingSignedUrlBatchTimer = null;
    void flushSignedMediaUrlBatch();
  }, SIGNED_URL_BATCH_WINDOW_MS);
}

function queueSignedUrlBatchRequest(objectPaths: string[]) {
  return new Promise<Record<string, string>>((resolve, reject) => {
    pendingSignedUrlRequests.push({
      objectPaths,
      reject,
      resolve,
    });
    scheduleSignedMediaUrlBatchFlush();
  });
}

export async function getSignedMediaUrls(objectPaths: string[]): Promise<Record<string, string>> {
  const normalizedPaths = normalizeObjectPaths(objectPaths);
  if (normalizedPaths.length === 0) return {};

  return queueSignedUrlBatchRequest(normalizedPaths);
}

export async function flushPendingSignedMediaUrlBatch() {
  if (pendingSignedUrlBatchTimer) {
    clearTimeout(pendingSignedUrlBatchTimer);
    pendingSignedUrlBatchTimer = null;
  }
  await flushSignedMediaUrlBatch();
}

export async function getSignedMediaUrl(objectPath: string): Promise<string> {
  const normalizedPath = normalizeObjectPath(objectPath);
  if (!normalizedPath) {
    throw new Error("URL alınamadı");
  }

  const signedUrl = normalizeText((await getSignedMediaUrls([normalizedPath]))[normalizedPath]);
  if (signedUrl) {
    return signedUrl;
  }

  throw new Error("URL alınamadı");
}
