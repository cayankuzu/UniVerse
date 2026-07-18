import { recordTelemetry, startTelemetryTimer } from "../telemetry";
import type { TelemetryCategory, TelemetryEvent } from "../telemetry/types";
import { redactString, redactValue } from "../security/redaction";
import { Sentry } from "./sentry";

type LogEventParams = Omit<TelemetryEvent, "category" | "timestamp"> & {
  category?: TelemetryCategory;
};

interface LogErrorContext {
  captureInSentry?: boolean;
  meta?: Record<string, unknown>;
  name?: string;
  screenKey?: string;
}

type SanitizedErrorContext = {
  operation?: string;
  sanitizedMeta: Record<string, unknown>;
  scope?: string;
  screenKey?: string;
};

function sanitizeObservedKey(value: unknown) {
  const normalized = redactString(String(value || "")).trim();
  return normalized ? normalized.slice(0, 160) : undefined;
}

function sanitizeErrorMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return {};
  const next: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (value == null) return;
    const sanitizedEntry = redactValue({ [key]: value }) as Record<string, unknown>;
    const sanitizedValue = sanitizedEntry[key];
    if (typeof sanitizedValue === "string") {
      next[key] = sanitizedValue.slice(0, 160);
      return;
    }
    if (typeof sanitizedValue === "number" || typeof sanitizedValue === "boolean") {
      next[key] = sanitizedValue;
      return;
    }
    if (Array.isArray(sanitizedValue)) {
      next[key] = sanitizedValue
        .slice(0, 8)
        .map((item) =>
          typeof item === "number" || typeof item === "boolean"
            ? item
            : redactString(String(item || "")).slice(0, 120),
        );
      return;
    }
    // Error logs keep only lightweight context to avoid leaking heavy payloads.
    next[key] = sanitizedValue;
  });
  return next;
}

export function logEvent(params: LogEventParams) {
  recordTelemetry({
    ...params,
    category: params.category || "screen",
  });
}

export function logScreenView(params: Omit<LogEventParams, "category">) {
  logEvent({
    ...params,
    category: "screen",
  });
}

export function logProjectionMetric(params: Omit<LogEventParams, "category">) {
  logEvent({
    ...params,
    category: "projection",
  });
}

export function logSecurityEvent(params: Omit<LogEventParams, "category">) {
  logEvent({
    ...params,
    category: "security",
  });
}

const ERROR_DEDUP_WINDOW_MS = 5_000;
const MAX_DEDUP_ENTRIES = 50;
const recentErrorFingerprints = new Map<string, number>();

function pruneRecentErrorFingerprints(now: number) {
  recentErrorFingerprints.forEach((lastSeen, fingerprint) => {
    if (now - lastSeen >= ERROR_DEDUP_WINDOW_MS) {
      recentErrorFingerprints.delete(fingerprint);
    }
  });
  while (recentErrorFingerprints.size > MAX_DEDUP_ENTRIES) {
    const oldest = recentErrorFingerprints.keys().next().value;
    if (!oldest) break;
    recentErrorFingerprints.delete(oldest);
  }
}

function isDuplicateError(fingerprint: string): boolean {
  const now = Date.now();
  pruneRecentErrorFingerprints(now);
  const lastSeen = recentErrorFingerprints.get(fingerprint);
  if (lastSeen && now - lastSeen < ERROR_DEDUP_WINDOW_MS) {
    return true;
  }
  recentErrorFingerprints.set(fingerprint, now);
  return false;
}

function buildErrorFingerprint(message: string, context: LogErrorContext) {
  return `${context.name || "error"}:${context.screenKey || ""}:${message.slice(0, 80)}`;
}

function sanitizeErrorContext(context: LogErrorContext): SanitizedErrorContext {
  const sanitizedMeta = sanitizeErrorMeta(context.meta);
  return {
    operation: sanitizeObservedKey(sanitizedMeta.operation),
    sanitizedMeta,
    scope: sanitizeObservedKey(sanitizedMeta.scope),
    screenKey: sanitizeObservedKey(context.screenKey),
  };
}

export function logError(error: unknown, context: LogErrorContext = {}) {
  const message = redactString(
    String((error as { message?: string } | null)?.message || error || "unknown-error"),
  ).slice(0, 240);
  const fingerprint = buildErrorFingerprint(message, context);
  if (isDuplicateError(fingerprint)) return;

  const { operation, sanitizedMeta, scope, screenKey } = sanitizeErrorContext(context);
  logEvent({
    category: "error",
    meta: {
      ...sanitizedMeta,
      message,
    },
    name: context.name || "error",
    screenKey,
    status: "error",
  });
  if (context.captureInSentry !== false) {
    Sentry.captureException(error, {
      extra: {
        ...sanitizedMeta,
        screenKey,
      },
      tags: {
        category: "error",
        ...(operation ? { operation } : {}),
        ...(scope ? { scope } : {}),
      },
    });
  }
}

export const startObservedTimer = startTelemetryTimer;

export {
  appReleaseMeta,
  crashReporterConfig,
  type AppReleaseEnvironment,
  type AppReleaseMeta,
  type CrashReporterConfig,
} from "./config";
export {
  captureReleaseHealthCheck,
  clearCrashReporterUser,
  initializeCrashReporter,
  registerNavigationContainer,
  Sentry,
  setCrashReporterUser,
  wrapRootComponent,
} from "./sentry";
