const REQUEST_TIMEOUT_MS = 12000;
const FAST_LIST_TIMEOUT_MS = 6500;
const MAX_IN_FLIGHT_GET_ENTRIES = 80;
const MAX_RECENT_RESPONSE_ENTRIES = 160;

export interface ApiError {
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Typed HTTP error that carries the status code so downstream code
 * can branch on `httpStatus` instead of parsing message strings.
 */
export class HttpRequestError extends Error {
  readonly httpStatus: number;
  readonly isTimeout: boolean;

  constructor(message: string, httpStatus: number, isTimeout = false) {
    super(message);
    this.name = "HttpRequestError";
    this.httpStatus = httpStatus;
    this.isTimeout = isTimeout;
  }
}

export function isHttpRequestError(error: unknown): error is HttpRequestError {
  return error instanceof HttpRequestError;
}

export interface TokenOptions {
  requireAuth?: boolean;
  directToken?: string;
  context?: string;
  forceAnon?: boolean;
}

export type AuthMode = "auto" | "anon" | "required";

export interface RequestOptions extends RequestInit {
  allowLegacyCompatRead?: boolean;
  authMode?: AuthMode;
  _retryDirectToken?: string;
  _retryInvalidJwt?: boolean;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export const inFlightGetRequests = new Map<string, Promise<unknown>>();
export const recentGetResponses = new Map<string, { expiresAt: number; value: unknown }>();

export function resolveRequestTimeout(method: string, path: string, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return override;
  }
  if (
    method === "GET" &&
    (/\/feed\b/.test(path) || path.startsWith("/notifications") || path.startsWith("/search"))
  ) {
    return FAST_LIST_TIMEOUT_MS;
  }
  return REQUEST_TIMEOUT_MS;
}

export function resolveCacheTtl(method: string, path: string, override?: number): number {
  if (typeof override === "number" && override >= 0) return override;
  if (
    method === "GET" &&
    (/\/feed\b/.test(path) || path.startsWith("/notifications") || path.startsWith("/search"))
  ) {
    return 1200;
  }
  return 0;
}

export function buildRequestCacheKey(
  method: string,
  path: string,
  authMode: AuthMode,
  token: string,
) {
  return `${method}:${authMode}:${path}:${String(token || "").slice(-16)}`;
}

export function trimOldestMapEntries<T>(map: Map<string, T>, maxEntries: number) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

export function trimInFlightGetRequests() {
  trimOldestMapEntries(inFlightGetRequests, MAX_IN_FLIGHT_GET_ENTRIES);
}

export function trimRecentGetResponses() {
  trimOldestMapEntries(recentGetResponses, MAX_RECENT_RESPONSE_ENTRIES);
}

function isRecoverableAuthMessage(message: string): boolean {
  return (
    message.includes("invalid jwt") ||
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("auth") ||
    message.includes("session") ||
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("yetki doğrulanamadı")
  );
}

export function isInvalidJwtResponse(status: number, data: unknown): boolean {
  if (status !== 401) return false;
  if (typeof data === "string") {
    const message = data.toLowerCase();
    return message.length === 0 || isRecoverableAuthMessage(message);
  }
  if (!data || typeof data !== "object") return true;
  const payload = data as ApiError;
  const message = String(payload.message || payload.error || payload.code || "").toLowerCase();
  return message.length === 0 || isRecoverableAuthMessage(message);
}
