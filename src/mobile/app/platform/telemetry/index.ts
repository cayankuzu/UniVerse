import { debugLog } from "../../platform/logging/logger";
import { supabase } from "../supabase";
import {
  buildBoundedRpcBatch,
  isTelemetryRpcErrorMessage,
  payloadItemToTelemetryEvent,
  type RpcTelemetryPayloadItem,
  summarizeRpcTelemetryPayloadItem,
} from "./telemetryPayload";
import { normalizeTelemetryEvent } from "./telemetrySanitization";
import type { TelemetryEvent } from "./types";

const MAX_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 200;
const FLUSH_DELAY_MS = 12_000;

let queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

async function sendTelemetryPayload(payload: RpcTelemetryPayloadItem[]) {
  return supabase.rpc("log_client_telemetry_batch", { payload });
}

async function recoverServerRejectedTelemetryPayload(payload: RpcTelemetryPayloadItem[]) {
  const invalidItems: RpcTelemetryPayloadItem[] = [];
  const retryItems: RpcTelemetryPayloadItem[] = [];

  for (const item of payload) {
    const { error } = await sendTelemetryPayload([item]);
    if (!error) {
      continue;
    }
    if (isTelemetryRpcErrorMessage(error, "telemetry_payload_invalid")) {
      invalidItems.push(item);
      continue;
    }
    retryItems.push(item);
  }

  return {
    invalidItems,
    retryItems,
  };
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetryQueue();
  }, delay);
}

export function recordTelemetry(event: TelemetryEvent) {
  const nextEvent = normalizeTelemetryEvent(event);

  queue.push(nextEvent);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }

  debugLog("TELEMETRY", `${nextEvent.category}:${nextEvent.name}`, {
    durationMs: nextEvent.durationMs,
    path: nextEvent.path,
    screenKey: nextEvent.screenKey,
    status: nextEvent.status,
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    void flushTelemetryQueue();
    return;
  }
  scheduleFlush();
}

export function startTelemetryTimer(baseEvent: Omit<TelemetryEvent, "durationMs" | "timestamp">) {
  const startedAt = Date.now();
  return (status: TelemetryEvent["status"] = "ok", meta?: Record<string, unknown>) => {
    recordTelemetry({
      ...baseEvent,
      durationMs: Math.max(0, Date.now() - startedAt),
      meta: {
        ...(baseEvent.meta || {}),
        ...(meta || {}),
      },
      status,
    });
  };
}

export async function flushTelemetryQueue() {
  if (flushPromise) return flushPromise;
  if (!queue.length) return;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  let batch: TelemetryEvent[] = [];
  flushPromise = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        scheduleFlush(FLUSH_DELAY_MS * 2);
        return;
      }

      batch = queue.splice(0, MAX_BATCH_SIZE);
      const preparedBatch = buildBoundedRpcBatch(batch);
      if (preparedBatch.dropped) {
        debugLog("TELEMETRY", "flush-drop-oversize", {
          size: preparedBatch.retainedBatch.length,
        });
        queue = [...preparedBatch.overflowBatch, ...queue].slice(-MAX_QUEUE_SIZE);
        if (queue.length) {
          scheduleFlush(0);
        }
        return;
      }
      if (preparedBatch.droppedInvalidItems > 0) {
        debugLog("TELEMETRY", "flush-drop-invalid", {
          dropped: preparedBatch.droppedInvalidItems,
          items: preparedBatch.invalidPayloadItems
            .slice(0, 6)
            .map((item) => summarizeRpcTelemetryPayloadItem(item)),
          size: preparedBatch.retainedBatch.length,
        });
      }
      if (preparedBatch.payload.length === 0) {
        queue = [...preparedBatch.overflowBatch, ...queue].slice(-MAX_QUEUE_SIZE);
        if (queue.length) {
          scheduleFlush(0);
        }
        return;
      }

      const { error } = await sendTelemetryPayload(preparedBatch.payload);
      if (error) {
        const message = String(error.message || "").toLowerCase();
        debugLog("TELEMETRY", "flush-error", {
          compacted: preparedBatch.compacted,
          message: error.message,
          items: preparedBatch.payload
            .slice(0, 6)
            .map((item) => summarizeRpcTelemetryPayloadItem(item)),
          size: preparedBatch.payload.length,
        });
        if (
          message.includes("telemetry_batch_too_large") ||
          message.includes("telemetry_payload_too_large")
        ) {
          queue = [...preparedBatch.overflowBatch, ...queue].slice(-MAX_QUEUE_SIZE);
          if (queue.length) {
            scheduleFlush(0);
          }
          return;
        }
        if (message.includes("telemetry_payload_invalid")) {
          const recovered = await recoverServerRejectedTelemetryPayload(preparedBatch.payload);
          if (recovered.invalidItems.length > 0) {
            debugLog("TELEMETRY", "flush-drop-server-invalid", {
              dropped: recovered.invalidItems.length,
              items: recovered.invalidItems
                .slice(0, 6)
                .map((item) => summarizeRpcTelemetryPayloadItem(item)),
            });
          }

          queue = [
            ...recovered.retryItems.map((item) => payloadItemToTelemetryEvent(item)),
            ...preparedBatch.overflowBatch,
            ...queue,
          ].slice(-MAX_QUEUE_SIZE);
          if (queue.length) {
            scheduleFlush(recovered.retryItems.length > 0 ? FLUSH_DELAY_MS * 2 : 0);
          }
          return;
        }

        queue = [...preparedBatch.retainedBatch, ...preparedBatch.overflowBatch, ...queue].slice(
          -MAX_QUEUE_SIZE,
        );
        scheduleFlush(FLUSH_DELAY_MS * 2);
        return;
      }

      queue = [...preparedBatch.overflowBatch, ...queue].slice(-MAX_QUEUE_SIZE);
      if (queue.length) {
        scheduleFlush(0);
      }
    } catch (error) {
      if (batch.length) {
        queue = [...batch, ...queue].slice(-MAX_QUEUE_SIZE);
      }
      debugLog("TELEMETRY", "flush-exception", {
        message: error instanceof Error ? error.message : String(error),
        retained: batch.length,
      });
      scheduleFlush(FLUSH_DELAY_MS * 2);
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}
