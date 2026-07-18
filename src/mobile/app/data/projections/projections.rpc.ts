import type { ProjectionEnvelope } from "../../data/query/contracts";
import { debugLog } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";
import { isFunctionUnavailable } from "../../platform/api/core";

const MAX_IN_FLIGHT_PROJECTION_RPC_ENTRIES = 120;
// Default projection RPCs can wait longer, but hot startup surfaces should
// fail open quickly to lighter SQL/table-backed fallbacks.
const DEFAULT_PROJECTION_RPC_TIMEOUT_MS = 12_000;
const PROJECTION_RPC_TIMEOUT_MS_BY_FUNCTION: Partial<Record<string, number>> = {
  blocked_users_projection: 1_800,
  event_detail_projection: 2_200,
  home_feed_projection: 2_500,
  notification_badge_projection: 2_200,
  notifications_projection: 2_500,
  search_results_projection: 2_500,
  search_results_projection_v2: 2_500,
};
const PROJECTION_RPC_TIMEOUT = Symbol("projection-rpc-timeout");
type ProjectionRpcGroup = "default" | "home" | "notifications" | "search" | "secondary";
type ProjectionRpcResult<T> =
  | {
      envelope: ProjectionEnvelope<T> | null;
      status: "completed";
    }
  | {
      status: "counted-failure";
    };

type InFlightProjectionRpcEntry = {
  request: Promise<ProjectionRpcResult<unknown>>;
  response: Promise<ProjectionEnvelope<unknown> | null>;
};

const inFlightProjectionRpcRequests = new Map<string, InFlightProjectionRpcEntry>();
const inFlightProjectionRpcGroups = new Map<ProjectionRpcGroup, number>();

const HOT_INITIAL_RPC_GROUP_LIMITS: Record<ProjectionRpcGroup, number> = {
  default: 3,
  home: 1,
  // Badge hydration and inbox projection commonly start together after
  // realtime/push wakeups, so allow both before failing open to table reads.
  notifications: 2,
  search: 1,
  secondary: 2,
};

// ── Circuit breaker ──────────────────────────────────────────────────
// Prevents cascading RPC failures from overloading a slow server.
// After CIRCUIT_BREAKER_THRESHOLD consecutive timeouts, new RPCs are
// short-circuited for CIRCUIT_BREAKER_COOLDOWN_MS.
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 15_000;
let consecutiveTimeouts = 0;
let circuitOpenUntil = 0;

function recordRpcSuccess() {
  consecutiveTimeouts = 0;
  circuitOpenUntil = 0;
}

function recordRpcTimeout() {
  consecutiveTimeouts += 1;
  if (consecutiveTimeouts >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    debugLog("PROJECTIONS", "circuit-breaker-open", {
      consecutiveTimeouts,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
    });
  }
}

function isCircuitOpen() {
  if (circuitOpenUntil <= 0) return false;
  if (Date.now() >= circuitOpenUntil) {
    // Cooldown elapsed — allow one probe request (half-open).
    circuitOpenUntil = 0;
    consecutiveTimeouts = CIRCUIT_BREAKER_THRESHOLD - 1;
    debugLog("PROJECTIONS", "circuit-breaker-half-open", {});
    return false;
  }
  return true;
}

type ProjectionResponseShape<T> = {
  items?: T[];
  updatedItems?: T[];
  updated_items?: T[];
  deletedIds?: string[];
  deleted_ids?: string[];
  nextCursor?: string | null;
  next_cursor?: string | null;
  serverTime?: string;
  server_time?: string;
  deltaToken?: string | null;
  delta_token?: string | null;
};

function trimOldestProjectionRpcEntries() {
  while (inFlightProjectionRpcRequests.size > MAX_IN_FLIGHT_PROJECTION_RPC_ENTRIES) {
    const oldestKey = inFlightProjectionRpcRequests.keys().next().value;
    if (!oldestKey) break;
    inFlightProjectionRpcRequests.delete(oldestKey);
  }
}

function stableSerializeProjectionRpcParams(params: Record<string, unknown>) {
  const normalizedEntries = Object.entries(params)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => [
      key,
      Array.isArray(value)
        ? [...value]
        : value && typeof value === "object"
          ? JSON.parse(JSON.stringify(value))
          : value,
    ]);
  return JSON.stringify(normalizedEntries);
}

function buildProjectionRpcRequestKey(fn: string, params: Record<string, unknown>) {
  return `${fn}:${stableSerializeProjectionRpcParams(params)}`;
}

function resolveProjectionRpcGroup(fn: string): ProjectionRpcGroup {
  if (fn === "home_feed_projection") return "home";
  if (fn === "notifications_projection" || fn === "notification_badge_projection") {
    return "notifications";
  }
  if (fn === "search_results_projection" || fn === "search_results_projection_v2") return "search";
  if (fn.endsWith("_projection")) return "secondary";
  return "default";
}

function getProjectionRpcGroupCount(group: ProjectionRpcGroup) {
  return inFlightProjectionRpcGroups.get(group) || 0;
}

function incrementProjectionRpcGroup(group: ProjectionRpcGroup) {
  inFlightProjectionRpcGroups.set(group, getProjectionRpcGroupCount(group) + 1);
}

function decrementProjectionRpcGroup(group: ProjectionRpcGroup) {
  const nextCount = getProjectionRpcGroupCount(group) - 1;
  if (nextCount <= 0) {
    inFlightProjectionRpcGroups.delete(group);
    return;
  }
  inFlightProjectionRpcGroups.set(group, nextCount);
}

function isInitialProjectionRpcRequest(params: Record<string, unknown>) {
  return !String(params.cursor || "").trim();
}

function shouldRejectSaturatedProjectionRpc(fn: string, params: Record<string, unknown>) {
  if (!isInitialProjectionRpcRequest(params)) return false;
  const group = resolveProjectionRpcGroup(fn);
  return getProjectionRpcGroupCount(group) >= HOT_INITIAL_RPC_GROUP_LIMITS[group];
}

function resolveProjectionRpcTimeoutMs(fn: string) {
  return PROJECTION_RPC_TIMEOUT_MS_BY_FUNCTION[fn] || DEFAULT_PROJECTION_RPC_TIMEOUT_MS;
}

async function awaitProjectionRpcWithTimeout<T>(
  fn: string,
  request: Promise<ProjectionRpcResult<T>>,
  timeoutMs = DEFAULT_PROJECTION_RPC_TIMEOUT_MS,
  onTimeout?: () => void,
) {
  if (timeoutMs <= 0) {
    const result = await request;
    if (result.status === "counted-failure") {
      recordRpcTimeout();
      return null;
    }
    recordRpcSuccess();
    return result.envelope;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const result = await Promise.race<ProjectionRpcResult<T> | typeof PROJECTION_RPC_TIMEOUT>([
      request,
      new Promise<typeof PROJECTION_RPC_TIMEOUT>((resolve) => {
        timeoutId = setTimeout(() => resolve(PROJECTION_RPC_TIMEOUT), timeoutMs);
      }),
    ]);

    if (result === PROJECTION_RPC_TIMEOUT) {
      onTimeout?.();
      recordRpcTimeout();
      debugLog("PROJECTIONS", "rpc-timeout-fallback", {
        fn,
        timeoutMs,
      });
      return null;
    }

    if (result.status === "counted-failure") {
      recordRpcTimeout();
      return null;
    }

    recordRpcSuccess();
    return result.envelope;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function nowEnvelope<T>(items: T[]): ProjectionEnvelope<T> {
  const serverTime = new Date().toISOString();
  return {
    items,
    nextCursor: null,
    serverTime,
    deltaToken: serverTime,
    updatedItems: [],
    deletedIds: [],
  };
}

export function mapEnvelopeItems<TInput, TOutput>(
  envelope: ProjectionEnvelope<TInput>,
  mapper: (item: TInput) => TOutput | null,
): ProjectionEnvelope<TOutput> {
  const mapRows = (items: TInput[] | undefined) =>
    (items || []).map(mapper).filter((item): item is TOutput => Boolean(item));
  return {
    ...envelope,
    items: mapRows(envelope.items),
    updatedItems: mapRows(envelope.updatedItems),
  };
}

export function shouldFallbackToLegacy() {
  return false;
}

export function normalizeEnvelope<T>(payload: unknown): ProjectionEnvelope<T> | null {
  const source = Array.isArray(payload)
    ? payload.length === 1 && payload[0] && typeof payload[0] === "object"
      ? (payload[0] as ProjectionResponseShape<T>)
      : null
    : payload && typeof payload === "object"
      ? (payload as ProjectionResponseShape<T>)
      : null;

  if (!source || !Array.isArray(source.items)) return null;
  const serverTime =
    String(source.serverTime || source.server_time || "").trim() || new Date().toISOString();
  return {
    items: source.items,
    updatedItems: source.updatedItems || source.updated_items || [],
    deletedIds: source.deletedIds || source.deleted_ids || [],
    nextCursor:
      typeof source.nextCursor === "string"
        ? source.nextCursor
        : typeof source.next_cursor === "string"
          ? source.next_cursor
          : null,
    serverTime,
    deltaToken:
      typeof source.deltaToken === "string"
        ? source.deltaToken
        : typeof source.delta_token === "string"
          ? source.delta_token
          : serverTime,
  };
}

export function resetProjectionRpcStateForTests() {
  consecutiveTimeouts = 0;
  circuitOpenUntil = 0;
  inFlightProjectionRpcRequests.clear();
  inFlightProjectionRpcGroups.clear();
}

export async function tryProjectionRpc<T>(
  fn: string,
  params: Record<string, unknown>,
): Promise<ProjectionEnvelope<T> | null> {
  // Circuit breaker: skip RPC if server is known to be unresponsive.
  if (isCircuitOpen()) {
    debugLog("PROJECTIONS", "rpc-circuit-breaker-rejected", { fn });
    return null;
  }

  const requestKey = buildProjectionRpcRequestKey(fn, params);
  const existingRequest = inFlightProjectionRpcRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest.response as Promise<ProjectionEnvelope<T> | null>;
  }
  if (shouldRejectSaturatedProjectionRpc(fn, params)) {
    debugLog("PROJECTIONS", "rpc-hot-group-saturated", {
      fn,
      group: resolveProjectionRpcGroup(fn),
    });
    return null;
  }

  const requestGroup = resolveProjectionRpcGroup(fn);
  incrementProjectionRpcGroup(requestGroup);
  const requestController = new AbortController();

  const request = (async () => {
    let result: Awaited<ReturnType<typeof supabase.rpc>>;
    try {
      const rpcRequest = supabase.rpc(fn, params);
      const abortableRpcRequest = rpcRequest as typeof rpcRequest & {
        abortSignal?: (signal: AbortSignal) => typeof rpcRequest;
      };
      const pendingRpc = abortableRpcRequest.abortSignal
        ? abortableRpcRequest.abortSignal(requestController.signal)
        : rpcRequest;
      result = await pendingRpc;
    } catch (error) {
      debugLog("PROJECTIONS", "rpc-request-failed", {
        fn,
        message: String((error as { message?: string })?.message || error || ""),
      });
      return {
        status: "counted-failure" as const,
      };
    }
    const { data, error } = result;
    if (error) {
      if (!isFunctionUnavailable(error)) {
        debugLog("PROJECTIONS", "rpc-fallback", { fn, message: error.message });
      }
      // Treat server errors (schema cache, connection) as timeouts for
      // circuit breaker purposes so we back off on unreachable servers.
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("schema cache") || msg.includes("could not") || msg.includes("timeout")) {
        return {
          status: "counted-failure" as const,
        };
      }
      return {
        envelope: null,
        status: "completed" as const,
      };
    }
    return {
      envelope: normalizeEnvelope<T>(data),
      status: "completed" as const,
    };
  })();
  const entry: InFlightProjectionRpcEntry = {
    request: request as Promise<ProjectionRpcResult<unknown>>,
    response: awaitProjectionRpcWithTimeout(fn, request, resolveProjectionRpcTimeoutMs(fn), () =>
      requestController.abort(),
    ),
  };

  inFlightProjectionRpcRequests.set(requestKey, entry);
  trimOldestProjectionRpcEntries();

  const finalizeRequest = () => {
    decrementProjectionRpcGroup(requestGroup);
    if (inFlightProjectionRpcRequests.get(requestKey) === entry) {
      inFlightProjectionRpcRequests.delete(requestKey);
    }
  };
  void request.then(finalizeRequest, finalizeRequest);

  return entry.response as Promise<ProjectionEnvelope<T> | null>;
}
