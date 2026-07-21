/** Request deduplication and caching: in-flight GET request tracking, cache TTL management, response reuse. */
import { logEvent } from "../observability";
import {
  type AuthMode,
  buildRequestCacheKey,
  inFlightGetRequests,
  recentGetResponses,
  trimInFlightGetRequests,
} from "./core.requestHelpers";

export interface CacheCheckResult<T> {
  hit: true;
  value: T;
}

const MAX_CONCURRENT_API_REQUESTS = 8;
type RequestSlotWaiter = {
  reject: (error: Error) => void;
  resolve: (release: () => void) => void;
  signal?: AbortSignal;
};

let activeApiRequestCount = 0;
const requestSlotQueue: RequestSlotWaiter[] = [];

function createQueuedRequestAbortError() {
  const error = new Error("İstek kuyrukta iptal edildi.");
  error.name = "AbortError";
  return error;
}

function drainRequestSlotQueue() {
  while (activeApiRequestCount < MAX_CONCURRENT_API_REQUESTS && requestSlotQueue.length > 0) {
    const waiter = requestSlotQueue.shift();
    if (!waiter) return;
    if (waiter.signal?.aborted) {
      waiter.reject(createQueuedRequestAbortError());
      continue;
    }
    activeApiRequestCount += 1;
    let released = false;
    waiter.resolve(() => {
      if (released) return;
      released = true;
      activeApiRequestCount = Math.max(0, activeApiRequestCount - 1);
      drainRequestSlotQueue();
    });
  }
}

export function acquireApiRequestSlot(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) return Promise.reject(createQueuedRequestAbortError());
  return new Promise((resolve, reject) => {
    const waiter: RequestSlotWaiter = { reject, resolve, signal };
    const handleAbort = () => {
      const queueIndex = requestSlotQueue.indexOf(waiter);
      if (queueIndex < 0) return;
      requestSlotQueue.splice(queueIndex, 1);
      reject(createQueuedRequestAbortError());
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
    waiter.resolve = (release) => {
      signal?.removeEventListener("abort", handleAbort);
      resolve(release);
    };
    requestSlotQueue.push(waiter);
    drainRequestSlotQueue();
  });
}

export function resetApiRequestSlotsForTests() {
  activeApiRequestCount = 0;
  requestSlotQueue.splice(0, requestSlotQueue.length);
}

/**
 * Attempt to return a cached GET response if one exists and has not expired.
 * Returns `null` when no usable cache entry is found.
 */
export function tryCachedGetResponse<T>(
  method: string,
  path: string,
  authMode: AuthMode,
  token: string,
): CacheCheckResult<T> | null {
  const cacheKey = buildRequestCacheKey(method, path, authMode, token);
  const cached = recentGetResponses.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    // Move to end (LRU refresh)
    recentGetResponses.delete(cacheKey);
    recentGetResponses.set(cacheKey, cached);
    logEvent({
      category: "api_request",
      meta: { source: "response-cache" },
      name: `${method} ${path}:cache-hit`,
      path,
      status: "ok",
    });
    return { hit: true, value: cached.value as T };
  }
  if (cached && cached.expiresAt <= Date.now()) {
    recentGetResponses.delete(cacheKey);
  }
  return null;
}

/**
 * If there is already an identical GET request in-flight, return the existing promise.
 * Returns `null` when there is no matching in-flight request.
 */
export function tryDedupeInflight<T>(
  method: string,
  path: string,
  authMode: AuthMode,
  token: string,
): Promise<T> | null {
  const cacheKey = buildRequestCacheKey(method, path, authMode, token);
  const inFlight = inFlightGetRequests.get(cacheKey);
  if (inFlight) {
    logEvent({
      category: "api_request",
      meta: { source: "in-flight-dedupe" },
      name: `${method} ${path}:dedupe-hit`,
      path,
      status: "ok",
    });
    return inFlight as Promise<T>;
  }
  return null;
}

/**
 * Register a GET promise in the in-flight map, await it, and clean up.
 */
export async function trackInflightGet<T>(
  promise: Promise<T>,
  method: string,
  path: string,
  authMode: AuthMode,
  token: string,
): Promise<T> {
  const cacheKey = buildRequestCacheKey(method, path, authMode, token);
  inFlightGetRequests.set(cacheKey, promise as Promise<unknown>);
  trimInFlightGetRequests();
  try {
    return await promise;
  } finally {
    inFlightGetRequests.delete(cacheKey);
  }
}

export { buildRequestCacheKey, resolveCacheTtl } from "./core.requestHelpers";
