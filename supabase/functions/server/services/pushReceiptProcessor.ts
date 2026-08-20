import type { SupabaseClient } from "npm:@supabase/supabase-js";
import { isRecoverableInactiveTokenError, type ExpoPushTicket } from "./pushNotifications.ts";

const EXPO_ACCESS_TOKEN = String(Deno.env.get("EXPO_ACCESS_TOKEN") || "").trim();
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const PUSH_RECEIPT_BATCH_LIMIT = 500;
const PUSH_RECEIPT_MIN_AGE_MS = 15 * 60_000;
const PUSH_RECEIPT_MAX_AGE_MS = 24 * 60 * 60_000;
const PUSH_RECEIPT_UPDATE_CONCURRENCY = 20;

type PendingPushDelivery = {
  attempted_at: string;
  notification_id: string;
  push_token_id: string;
  ticket_id: string;
};

type ExpoPushReceipt = ExpoPushTicket & {
  raw: unknown;
};

function normalizeExpoPushReceipt(value: unknown): ExpoPushReceipt {
  if (!value || typeof value !== "object") {
    return {
      message: "invalid-expo-receipt",
      raw: value,
      status: "error",
    };
  }
  const item = value as Record<string, unknown>;
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : null;
  return {
    errorCode: String(details?.error || "").trim() || undefined,
    message: String(item.message || "").trim() || undefined,
    raw: value,
    status: item.status === "ok" ? "ok" : "error",
  };
}

function createReceiptHeaders() {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (EXPO_ACCESS_TOKEN) {
    headers.set("authorization", `Bearer ${EXPO_ACCESS_TOKEN}`);
  }
  return headers;
}

async function updateInChunks<T>(items: T[], updateItem: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += PUSH_RECEIPT_UPDATE_CONCURRENCY) {
    await Promise.all(
      items.slice(index, index + PUSH_RECEIPT_UPDATE_CONCURRENCY).map((item) => updateItem(item)),
    );
  }
}

function failedReceiptResult(error: unknown, expiredCount: number) {
  return {
    checkedCount: 0,
    deactivatedCount: 0,
    error,
    errorCount: 0,
    expiredCount,
    missingCount: 0,
    sentCount: 0,
  };
}

export async function reconcilePendingPushReceipts(adminSupabase: SupabaseClient) {
  const now = Date.now();
  const receiptEligibleAt = new Date(now - PUSH_RECEIPT_MIN_AGE_MS).toISOString();
  const receiptExpiredAt = new Date(now - PUSH_RECEIPT_MAX_AGE_MS).toISOString();
  const reconciledAt = new Date(now).toISOString();

  const { data: expiredRows, error: expiredError } = await adminSupabase
    .from("notification_push_deliveries")
    .update({
      delivered_at: null,
      error_code: "ReceiptExpired",
      error_message: "Expo push receipt was not available within 24 hours.",
      status: "error",
    })
    .eq("status", "pending")
    .not("ticket_id", "is", null)
    .lte("attempted_at", receiptExpiredAt)
    .select("notification_id");
  if (expiredError) {
    return failedReceiptResult(expiredError, 0);
  }

  const { data, error } = await adminSupabase
    .from("notification_push_deliveries")
    .select("notification_id,push_token_id,ticket_id,attempted_at")
    .eq("status", "pending")
    .not("ticket_id", "is", null)
    .gt("attempted_at", receiptExpiredAt)
    .lte("attempted_at", receiptEligibleAt)
    .order("attempted_at", { ascending: true })
    .limit(PUSH_RECEIPT_BATCH_LIMIT);
  if (error) {
    return failedReceiptResult(error, expiredRows?.length || 0);
  }

  const deliveries = (data || []) as PendingPushDelivery[];
  if (deliveries.length === 0) {
    return {
      checkedCount: 0,
      deactivatedCount: 0,
      error: null,
      errorCount: 0,
      expiredCount: expiredRows?.length || 0,
      missingCount: 0,
      sentCount: 0,
    };
  }

  let response: Response;
  try {
    response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
      body: JSON.stringify({ ids: deliveries.map((item) => item.ticket_id) }),
      headers: createReceiptHeaders(),
      method: "POST",
    });
  } catch (fetchError) {
    return failedReceiptResult(fetchError, expiredRows?.length || 0);
  }

  const raw = await response.json().catch(() => null);
  if (!response.ok) {
    return failedReceiptResult(
      new Error(`Expo push receipt request failed with HTTP ${response.status}.`),
      expiredRows?.length || 0,
    );
  }
  const receiptMap =
    raw && typeof raw === "object" && (raw as { data?: unknown }).data
      ? (raw as { data: Record<string, unknown> }).data || {}
      : {};

  let deactivatedCount = 0;
  let errorCount = 0;
  let missingCount = 0;
  let sentCount = 0;

  await updateInChunks(deliveries, async (delivery) => {
    const rawReceipt = receiptMap[delivery.ticket_id];
    if (!rawReceipt) {
      missingCount += 1;
      return;
    }
    const receipt = normalizeExpoPushReceipt(rawReceipt);
    if (receipt.status === "ok") {
      const { error: updateError } = await adminSupabase
        .from("notification_push_deliveries")
        .update({
          delivered_at: reconciledAt,
          error_code: null,
          error_message: null,
          response: receipt.raw,
          status: "sent",
        })
        .eq("notification_id", delivery.notification_id)
        .eq("push_token_id", delivery.push_token_id)
        .eq("status", "pending")
        .eq("ticket_id", delivery.ticket_id);
      if (updateError) throw updateError;
      sentCount += 1;
      return;
    }

    const { error: updateError } = await adminSupabase
      .from("notification_push_deliveries")
      .update({
        delivered_at: null,
        error_code: receipt.errorCode || null,
        error_message: receipt.message || "Expo push receipt failed.",
        response: receipt.raw,
        status: "error",
      })
      .eq("notification_id", delivery.notification_id)
      .eq("push_token_id", delivery.push_token_id)
      .eq("status", "pending")
      .eq("ticket_id", delivery.ticket_id);
    if (updateError) throw updateError;
    errorCount += 1;

    if (isRecoverableInactiveTokenError(receipt)) {
      const { error: deactivateError } = await adminSupabase
        .from("push_device_tokens")
        .update({
          is_active: false,
          last_seen_at: reconciledAt,
        })
        .eq("id", delivery.push_token_id);
      if (deactivateError) throw deactivateError;
      deactivatedCount += 1;
    }
  });

  return {
    checkedCount: deliveries.length,
    deactivatedCount,
    error: null,
    errorCount,
    expiredCount: expiredRows?.length || 0,
    missingCount,
    sentCount,
  };
}
