import type { TelemetryEvent } from "./types";
import {
  MAX_CATEGORY_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_META_BYTES,
  MAX_PATH_LENGTH,
  MAX_RPC_BATCH_BYTES,
  MAX_SCREEN_KEY_LENGTH,
  MAX_STATUS_LENGTH,
} from "./telemetrySanitization";

export interface RpcTelemetryPayloadItem {
  category: string;
  duration_ms?: number;
  event_name: string;
  meta: Record<string, unknown>;
  path: string | null;
  screen_key: string | null;
  status: TelemetryEvent["status"] | null;
  timestamp: string;
}

export type RpcTelemetryPayloadSummary = {
  category: string;
  eventName: string;
  path: string | null;
  screenKey: string | null;
  status: TelemetryEvent["status"] | null;
};

const TIMESTAMP_PREFIX_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/;

function measureSerializedBytes(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return JSON.stringify(value).length;
  }
}

function toRpcPayload(
  batch: TelemetryEvent[],
  options: { compactMeta?: boolean } = {},
): RpcTelemetryPayloadItem[] {
  return batch.map((item) => {
    const entry: RpcTelemetryPayloadItem = {
      category: item.category,
      event_name: item.name,
      meta: options.compactMeta ? {} : item.meta || {},
      path: item.path || null,
      screen_key: item.screenKey || null,
      status: item.status || null,
      timestamp: item.timestamp || new Date().toISOString(),
    };
    if (typeof item.durationMs === "number" && Number.isFinite(item.durationMs)) {
      entry.duration_ms = Math.max(0, item.durationMs);
    }
    return entry;
  });
}

function measurePayloadBytes(payload: RpcTelemetryPayloadItem[]) {
  return measureSerializedBytes(payload);
}

function isValidRpcTelemetryPayloadItem(item: RpcTelemetryPayloadItem) {
  if (!item || typeof item !== "object") return false;
  if (!item.category.trim() || item.category.trim().length > MAX_CATEGORY_LENGTH) return false;
  if (!item.event_name.trim() || item.event_name.trim().length > MAX_EVENT_NAME_LENGTH)
    return false;
  if (item.status && item.status.trim().length > MAX_STATUS_LENGTH) return false;
  if (item.screen_key && item.screen_key.trim().length > MAX_SCREEN_KEY_LENGTH) return false;
  if (item.path && item.path.trim().length > MAX_PATH_LENGTH) return false;
  if (
    item.duration_ms !== undefined &&
    (typeof item.duration_ms !== "number" || !Number.isFinite(item.duration_ms))
  ) {
    return false;
  }
  if (!item.timestamp.trim() || !TIMESTAMP_PREFIX_REGEX.test(item.timestamp.trim())) return false;
  if (!item.meta || typeof item.meta !== "object" || Array.isArray(item.meta)) return false;
  if (measureSerializedBytes(item.meta) > MAX_META_BYTES) return false;
  return true;
}

function filterValidRpcPayload(payload: RpcTelemetryPayloadItem[]) {
  const validPayload: RpcTelemetryPayloadItem[] = [];
  const invalidItems: RpcTelemetryPayloadItem[] = [];
  let droppedCount = 0;

  payload.forEach((item) => {
    if (isValidRpcTelemetryPayloadItem(item)) {
      validPayload.push(item);
      return;
    }
    droppedCount += 1;
    invalidItems.push(item);
  });

  return {
    droppedCount,
    invalidItems,
    payload: validPayload,
  };
}

export function buildBoundedRpcBatch(batch: TelemetryEvent[]) {
  let retainedBatch = [...batch];
  while (retainedBatch.length > 1) {
    const filtered = filterValidRpcPayload(toRpcPayload(retainedBatch));
    const payload = filtered.payload;
    if (measurePayloadBytes(payload) <= MAX_RPC_BATCH_BYTES) {
      return {
        compacted: false,
        dropped: false,
        droppedInvalidItems: filtered.droppedCount,
        invalidPayloadItems: filtered.invalidItems,
        overflowBatch: batch.slice(retainedBatch.length),
        payload,
        retainedBatch,
      };
    }
    retainedBatch = retainedBatch.slice(0, Math.ceil(retainedBatch.length / 2));
  }

  const filteredPayload = filterValidRpcPayload(toRpcPayload(retainedBatch));
  const payload = filteredPayload.payload;
  if (measurePayloadBytes(payload) <= MAX_RPC_BATCH_BYTES) {
    return {
      compacted: false,
      dropped: false,
      droppedInvalidItems: filteredPayload.droppedCount,
      invalidPayloadItems: filteredPayload.invalidItems,
      overflowBatch: batch.slice(retainedBatch.length),
      payload,
      retainedBatch,
    };
  }

  const filteredCompactPayload = filterValidRpcPayload(
    toRpcPayload(retainedBatch, { compactMeta: true }),
  );
  const compactPayload = filteredCompactPayload.payload;
  if (measurePayloadBytes(compactPayload) <= MAX_RPC_BATCH_BYTES) {
    return {
      compacted: true,
      dropped: false,
      droppedInvalidItems: filteredCompactPayload.droppedCount,
      invalidPayloadItems: filteredCompactPayload.invalidItems,
      overflowBatch: batch.slice(retainedBatch.length),
      payload: compactPayload,
      retainedBatch,
    };
  }

  return {
    compacted: true,
    dropped: true,
    droppedInvalidItems: retainedBatch.length,
    invalidPayloadItems: toRpcPayload(retainedBatch, { compactMeta: true }),
    overflowBatch: batch.slice(retainedBatch.length),
    payload: [] as RpcTelemetryPayloadItem[],
    retainedBatch,
  };
}

export function isTelemetryRpcErrorMessage(error: unknown, messageFragment: string) {
  return String((error as { message?: string } | null)?.message || "")
    .toLowerCase()
    .includes(messageFragment);
}

export function summarizeRpcTelemetryPayloadItem(
  item: RpcTelemetryPayloadItem,
): RpcTelemetryPayloadSummary {
  return {
    category: item.category,
    eventName: item.event_name,
    path: item.path || null,
    screenKey: item.screen_key || null,
    status: item.status || null,
  };
}

export function payloadItemToTelemetryEvent(item: RpcTelemetryPayloadItem): TelemetryEvent {
  return {
    category: item.category as TelemetryEvent["category"],
    durationMs: item.duration_ms,
    meta: item.meta,
    name: item.event_name,
    path: item.path || undefined,
    screenKey: item.screen_key || undefined,
    status: item.status || undefined,
    timestamp: item.timestamp,
  };
}
