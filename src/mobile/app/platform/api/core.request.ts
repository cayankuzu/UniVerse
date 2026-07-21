import { debugLog } from "../../platform/logging/logger";
import { logEvent, startObservedTimer } from "../observability";
import {
  type ApiError,
  HttpRequestError,
  type RequestOptions,
  isInvalidJwtResponse,
  recentGetResponses,
  resolveCacheTtl,
  resolveRequestTimeout,
  buildRequestCacheKey,
  trimRecentGetResponses,
} from "./core.requestHelpers";
import { getToken, tryRecoverAuthSession } from "./core.auth";
import { buildRequestHeaders } from "./core.headers";
import {
  acquireApiRequestSlot,
  tryCachedGetResponse,
  tryDedupeInflight,
  trackInflightGet,
} from "./core.requestPool";
import { BASE_URL, DEBUG_API_TRACE } from "./core.shared";

function createRequestAbortBridge(params: {
  callerSignal?: AbortSignal | null;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => {
    controller.abort();
  };
  const requestTimeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, params.timeoutMs);
  if (params.callerSignal?.aborted) {
    controller.abort();
  } else {
    params.callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    cleanup: () => {
      clearTimeout(requestTimeout);
      params.callerSignal?.removeEventListener("abort", abortFromCaller);
    },
    didTimeout: () => timedOut,
    signal: controller.signal,
  };
}

async function readResponseBody(res: Response) {
  const rawBody = await res.text().catch(() => "");
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

async function executeRequest<T>(
  path: string,
  options: RequestOptions,
  token: string,
  method: string,
): Promise<T> {
  const {
    allowLegacyCompatRead: _ignoredLegacyCompatRead,
    authMode: _ignoredAuthMode,
    _retryDirectToken: _ignoredRetryDirectToken,
    _retryInvalidJwt: _ignoredRetry,
    timeoutMs,
    cacheTtlMs,
    ...fetchOptions
  } = options;
  const { signal: callerSignal, ...requestInit } = fetchOptions;
  const resolvedTimeout = resolveRequestTimeout(method, path, timeoutMs);
  const stopRequestTelemetry = startObservedTimer({
    category: "api_request",
    meta: { authMode: options.authMode || "required" },
    name: `${method} ${path}`,
    path,
  });
  debugLog("API/REQUEST", `${method} ${path} -> start`);
  if (DEBUG_API_TRACE) {
    const traceBody =
      typeof fetchOptions.body === "string"
        ? fetchOptions.body
        : fetchOptions.body
          ? String(fetchOptions.body)
          : "";
    debugLog("API/REQUEST", `${method} ${path} -> payload`, {
      hasBody: Boolean(traceBody),
      bodyPreview: traceBody.slice(0, 1000),
    });
  }
  const abortBridge = createRequestAbortBridge({
    callerSignal,
    timeoutMs: resolvedTimeout,
  });
  let res: Response;
  let releaseRequestSlot: () => void = () => undefined;
  try {
    releaseRequestSlot = await acquireApiRequestSlot(abortBridge.signal);
    res = await fetch(`${BASE_URL}${path}`, {
      ...requestInit,
      signal: abortBridge.signal,
      headers: buildRequestHeaders(requestInit.headers, token),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      stopRequestTelemetry("error", {
        message: abortBridge.didTimeout() ? "abort-timeout" : "abort-caller",
      });
      throw new HttpRequestError(
        abortBridge.didTimeout()
          ? "İstek zaman aşımına uğradı. Lütfen tekrar deneyin."
          : "İstek iptal edildi.",
        0,
        abortBridge.didTimeout(),
      );
    }
    stopRequestTelemetry("error", {
      message: String((error as { message?: string })?.message || error || ""),
    });
    throw error;
  } finally {
    releaseRequestSlot();
    abortBridge.cleanup();
  }

  const data = await readResponseBody(res);

  debugLog("API/REQUEST", `${method} ${path} <- ${res.status}`);
  logEvent({
    category: "api_request",
    meta: {
      statusCode: res.status,
    },
    name: `${method} ${path}:status`,
    path,
    status: res.ok ? "ok" : "error",
  });
  if (DEBUG_API_TRACE) {
    let serialized = "";
    if (typeof data === "string") serialized = data;
    else if (data != null) {
      try {
        serialized = JSON.stringify(data);
      } catch {
        serialized = String(data);
      }
    }
    debugLog("API/REQUEST", `${method} ${path} <- payload`, {
      status: res.status,
      bodyPreview: serialized.slice(0, 2000),
    });
  }
  if (isInvalidJwtResponse(res.status, data)) {
    debugLog("API/AUTH", `Invalid JWT detected for ${method} ${path}`);
    if (!options._retryInvalidJwt && options.authMode !== "anon") {
      const recoveredToken = await tryRecoverAuthSession(`${method} ${path}`);
      if (recoveredToken) {
        debugLog("API/AUTH", `Retrying request after refresh for ${method} ${path}`);
        stopRequestTelemetry("rollback", { retryAfterRefresh: true, statusCode: res.status });
        return request<T>(path, {
          ...options,
          _retryDirectToken: recoveredToken,
          _retryInvalidJwt: true,
        });
      }
    }
    stopRequestTelemetry("error", { invalidJwt: true, statusCode: res.status });
    throw new HttpRequestError("Oturum geçersiz. Lütfen tekrar giriş yap.", res.status);
  }
  if (!res.ok) {
    debugLog("API/REQUEST", `${method} ${path} error payload`, data);
    stopRequestTelemetry("error", { statusCode: res.status });
    if (typeof data === "object" && data) {
      const parsed = data as ApiError;
      const parsedMessage = parsed.error || parsed.message || parsed.code || `HTTP ${res.status}`;
      if (isInvalidJwtResponse(res.status, data)) {
        throw new HttpRequestError("Oturum geçersiz. Lütfen tekrar giriş yap.", res.status);
      }
      throw new HttpRequestError(parsedMessage, res.status);
    }
    throw new HttpRequestError(
      typeof data === "string" && data ? data : `HTTP ${res.status}`,
      res.status,
    );
  }

  const ttl = resolveCacheTtl(method, path, cacheTtlMs);
  if (method === "GET" && ttl > 0 && !callerSignal) {
    recentGetResponses.set(
      buildRequestCacheKey(method, path, options.authMode || "required", token),
      { expiresAt: Date.now() + ttl, value: data },
    );
    trimRecentGetResponses();
  }
  stopRequestTelemetry("ok", {
    cachedTtlMs: ttl,
    statusCode: res.status,
  });
  return data as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authMode = options.authMode || "required";
  const retryInvalidJwt = Boolean(options._retryInvalidJwt);
  const method = (options.method || "GET").toUpperCase();
  const token = await getToken({
    context: path,
    directToken: options._retryDirectToken,
    requireAuth: authMode === "required",
    forceAnon: authMode === "anon",
  });

  const cacheTtl = resolveCacheTtl(method, path, options.cacheTtlMs);
  const canReuseGet = method === "GET" && !retryInvalidJwt && !options.signal;

  if (canReuseGet && cacheTtl > 0) {
    const cached = tryCachedGetResponse<T>(method, path, authMode, token);
    if (cached) return cached.value;
  }
  if (canReuseGet) {
    const deduped = tryDedupeInflight<T>(method, path, authMode, token);
    if (deduped) return deduped;
  }

  const promise = executeRequest<T>(
    path,
    { ...options, authMode, _retryInvalidJwt: retryInvalidJwt },
    token,
    method,
  );
  if (canReuseGet) {
    return trackInflightGet(promise, method, path, authMode, token);
  }
  return promise;
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, options);
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, {
    ...options,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, {
    ...options,
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: "DELETE" });
}
