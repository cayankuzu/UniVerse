import { logSecurityEvent } from "../observability";

type SecurityTelemetryResult = "denied" | "fail" | "not_found" | "skipped" | "success";

const recentSecurityEvents = new Map<string, number>();
const DEFAULT_DEDUPE_WINDOW_MS = 10_000;
const MAX_RECENT_SECURITY_EVENTS = 80;

function trimOldSecurityEvents(now: number) {
  for (const [key, lastSeenAt] of recentSecurityEvents.entries()) {
    if (now - lastSeenAt > DEFAULT_DEDUPE_WINDOW_MS * 3) {
      recentSecurityEvents.delete(key);
    }
  }
  while (recentSecurityEvents.size > MAX_RECENT_SECURITY_EVENTS) {
    const oldestKey = recentSecurityEvents.keys().next().value;
    if (!oldestKey) break;
    recentSecurityEvents.delete(oldestKey);
  }
}

function resultToStatus(result: SecurityTelemetryResult) {
  if (result === "success") return "ok";
  if (result === "skipped") return "skipped";
  return "error";
}

export function recordSecurityTelemetryEvent(params: {
  action: string;
  dedupeWindowMs?: number;
  meta?: Record<string, unknown>;
  resourceId?: string | null;
  resourceType: string;
  result: SecurityTelemetryResult;
}) {
  const action = String(params.action || "").trim();
  const resourceType = String(params.resourceType || "").trim();
  const resourceId = String(params.resourceId || "").trim();
  if (!action || !resourceType) return;

  const dedupeWindowMs = Math.max(0, Math.trunc(params.dedupeWindowMs || DEFAULT_DEDUPE_WINDOW_MS));
  const dedupeKey = [action, resourceType, resourceId, params.result].join(":");
  const now = Date.now();
  const lastSeenAt = recentSecurityEvents.get(dedupeKey);
  if (lastSeenAt && now - lastSeenAt < dedupeWindowMs) {
    return;
  }
  recentSecurityEvents.set(dedupeKey, now);
  trimOldSecurityEvents(now);

  logSecurityEvent({
    meta: {
      action,
      resourceId: resourceId || undefined,
      resourceType,
      result: params.result,
      ...(params.meta || {}),
    },
    name: action,
    screenKey: `${resourceType}:${resourceId || "unknown"}`,
    status: resultToStatus(params.result),
  });
}
