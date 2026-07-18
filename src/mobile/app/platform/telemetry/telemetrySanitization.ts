import { redactString, redactValue } from "../security/redaction";
import type { TelemetryEvent } from "./types";

export const MAX_RPC_BATCH_BYTES = 24_576;
export const MAX_CATEGORY_LENGTH = 48;
export const MAX_EVENT_NAME_LENGTH = 120;
export const MAX_STATUS_LENGTH = 32;
export const MAX_SCREEN_KEY_LENGTH = 120;
export const MAX_PATH_LENGTH = 240;
export const MAX_META_BYTES = 4096;

function measureSerializedBytes(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return JSON.stringify(value).length;
  }
}

function normalizeTelemetryString(value: unknown, maxLength: number) {
  const normalized = redactString(String(value || "")).trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
}

function normalizeTelemetryTimestamp(value: unknown) {
  const normalized = redactString(String(value || "")).trim();
  if (!normalized) return new Date().toISOString();
  const parsedAt = Date.parse(normalized);
  if (!Number.isFinite(parsedAt)) return new Date().toISOString();
  return new Date(parsedAt).toISOString();
}

function compactMetaValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value).slice(0, 120);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 6)
      .map((item) =>
        typeof item === "number" || typeof item === "boolean"
          ? item
          : redactString(String(item || "")).slice(0, 80),
      );
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>)
      .slice(0, 8)
      .forEach(([key, item]) => {
        if (item == null) return;
        if (typeof item === "number" || typeof item === "boolean") {
          next[key] = item;
          return;
        }
        next[key] = redactString(String(item || "")).slice(0, 80);
      });
    return next;
  }
  return redactString(String(value || "")).slice(0, 120);
}

function fitMetaToLimit(meta: Record<string, unknown>) {
  if (measureSerializedBytes(meta) <= MAX_META_BYTES) return meta;

  const compacted: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    const compactValue = compactMetaValue(value);
    const next = { ...compacted, [key]: compactValue };
    if (measureSerializedBytes(next) <= MAX_META_BYTES) {
      compacted[key] = compactValue;
    }
  });

  if (measureSerializedBytes(compacted) <= MAX_META_BYTES) {
    return compacted;
  }

  return {};
}

function sanitizeMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return {};
  const next: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === "string") {
      next[key] = redactString(value).slice(0, 240);
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      next[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      next[key] = value.slice(0, 12).map((item) => redactString(String(item || "")).slice(0, 120));
      return;
    }
    try {
      next[key] = redactValue(JSON.parse(JSON.stringify(value)));
    } catch {
      next[key] = redactString(String(value || "")).slice(0, 240);
    }
  });
  return fitMetaToLimit(next);
}

export function normalizeTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  const name = normalizeTelemetryString(event.name, MAX_EVENT_NAME_LENGTH) || "unknown";
  const path = normalizeTelemetryString(event.path, MAX_PATH_LENGTH);
  const screenKey = normalizeTelemetryString(event.screenKey, MAX_SCREEN_KEY_LENGTH);
  const status = normalizeTelemetryString(event.status, MAX_STATUS_LENGTH) as
    TelemetryEvent["status"] | "";

  return {
    ...event,
    category: (normalizeTelemetryString(event.category, MAX_CATEGORY_LENGTH) ||
      "screen") as TelemetryEvent["category"],
    durationMs:
      typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
        ? Math.max(0, event.durationMs)
        : undefined,
    meta: sanitizeMeta(event.meta),
    name,
    path: path || undefined,
    screenKey: screenKey || undefined,
    status: status || undefined,
    timestamp: normalizeTelemetryTimestamp(event.timestamp),
  };
}
