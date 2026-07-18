import type { SupabaseClient } from "npm:@supabase/supabase-js";
import { logError, logInfo } from "../logging.ts";
import { getRequestClientAddress, consumeRateLimitWindow } from "../rateLimit.ts";
import type { EdgeRouteContext } from "../types.ts";

type SecurityAuditResult = "blocked" | "denied" | "fail" | "rate_limited" | "success";
type SecuritySignalSeverity = "low" | "medium" | "high";
type SecuritySignalType = "burst" | "repeated_access" | "spam";

function sanitizeAuditText(value: unknown, maxLength: number) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function normalizeAuditMetadata(meta: Record<string, unknown> | undefined) {
  if (!meta) return {};
  const next: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (!key || value == null) return;
    if (typeof value === "number" || typeof value === "boolean") {
      next[key.slice(0, 60)] = value;
      return;
    }
    next[key.slice(0, 60)] = sanitizeAuditText(value, 240);
  });
  return next;
}

function buildSignalWindowBucket(windowMs: number) {
  const bucketMs = Math.max(1_000, Math.trunc(windowMs));
  return new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
}

function buildSignalSubjectKey(userId: string, ipAddress: string) {
  if (userId) return `user:${userId}`;
  if (ipAddress) return `ip:${ipAddress}`;
  return "anonymous";
}

export async function recordSecurityAuditEvent(params: {
  action: string;
  adminSupabase: SupabaseClient;
  c?: EdgeRouteContext;
  metadata?: Record<string, unknown>;
  resourceId?: string | null;
  resourceType?: string | null;
  result: SecurityAuditResult;
  userId?: string | null;
}) {
  const action = sanitizeAuditText(params.action, 120);
  if (!action) return;
  const userId = sanitizeAuditText(params.userId, 80) || null;
  const ipAddress = params.c ? sanitizeAuditText(getRequestClientAddress(params.c), 80) : null;
  const resourceType = sanitizeAuditText(params.resourceType, 80) || null;
  const resourceId = sanitizeAuditText(params.resourceId, 240) || null;
  const result = sanitizeAuditText(params.result, 32) || "fail";
  const metadata = normalizeAuditMetadata(params.metadata);

  try {
    const { error } = await params.adminSupabase.from("security_audit_logs").insert({
      action,
      ip_address: ipAddress,
      metadata,
      resource_id: resourceId,
      resource_type: resourceType,
      result,
      user_id: userId,
    });
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    logError("security/audit", "security-audit-record-failed", error, {
      action,
      resourceId,
      resourceType,
      result,
      userId,
    });
  }
}

export async function trackSecurityDetectionSignal(params: {
  action: string;
  adminSupabase: SupabaseClient;
  c?: EdgeRouteContext;
  metadata?: Record<string, unknown>;
  resourceId?: string | null;
  resourceType?: string | null;
  result?: string | null;
  severity: SecuritySignalSeverity;
  signalType: SecuritySignalType;
  threshold: number;
  userId?: string | null;
  windowMs: number;
}) {
  const action = sanitizeAuditText(params.action, 120);
  if (!action) return;
  const threshold = Math.max(1, Math.trunc(params.threshold));
  const userId = sanitizeAuditText(params.userId, 80);
  const ipAddress = params.c ? sanitizeAuditText(getRequestClientAddress(params.c), 80) : "";
  const subjectKey = buildSignalSubjectKey(userId, ipAddress);

  try {
    const rateWindow = await consumeRateLimitWindow({
      limit: threshold,
      scope: `security-signal:${sanitizeAuditText(params.signalType, 32)}:${action}`,
      subject: subjectKey,
      windowMs: params.windowMs,
    });
    if (rateWindow.currentCount < threshold) {
      return;
    }

    const resourceType = sanitizeAuditText(params.resourceType, 80);
    const resourceId = sanitizeAuditText(params.resourceId, 240);
    const payload = {
      action,
      event_count: rateWindow.currentCount,
      ip_address: ipAddress,
      metadata: {
        ...normalizeAuditMetadata(params.metadata),
        threshold,
        windowMs: Math.max(1_000, Math.trunc(params.windowMs)),
      },
      resource_id: resourceId,
      resource_type: resourceType,
      result: sanitizeAuditText(params.result, 32),
      severity: sanitizeAuditText(params.severity, 16),
      signal_type: sanitizeAuditText(params.signalType, 32),
      subject_key: subjectKey,
      updated_at: new Date().toISOString(),
      user_id: userId || null,
      window_bucket: buildSignalWindowBucket(params.windowMs),
    };
    const { error } = await params.adminSupabase
      .from("security_detection_signals")
      .upsert(payload, {
        onConflict: "signal_type,action,subject_key,resource_type,resource_id,window_bucket",
      });
    if (error) {
      throw new Error(error.message);
    }
    logInfo("security/detection", "security-detection-signal-recorded", {
      action,
      currentCount: rateWindow.currentCount,
      resourceId,
      resourceType,
      severity: payload.severity,
      signalType: payload.signal_type,
      subjectKey,
      userId: userId || undefined,
    });
  } catch (error) {
    logError("security/detection", "security-detection-signal-failed", error, {
      action,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      userId: userId || undefined,
    });
  }
}
