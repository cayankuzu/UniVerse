import type { SupabaseClient } from "npm:@supabase/supabase-js";
import { logError, logInfo } from "../logging.ts";

const PUSH_DISPATCH_BATCH_LIMIT = 24;
const PUSH_DISPATCH_CLAIM_SECONDS = 90;
const PUSH_DISPATCH_MAX_ATTEMPTS = 6;
const PUSH_DISPATCH_RETRY_BASE_SECONDS = 5;
const PUSH_DISPATCH_RETRY_MAX_SECONDS = 120;

type QueueRow = {
  attempt_count?: number | null;
  notification_id?: string | null;
};

export interface ClaimedPushDispatchEntry {
  attemptCount: number;
  notificationId: string;
}

function clampRetryDelaySeconds(attemptCount: number) {
  return Math.min(
    PUSH_DISPATCH_RETRY_MAX_SECONDS,
    PUSH_DISPATCH_RETRY_BASE_SECONDS * Math.max(1, 2 ** Math.max(0, attemptCount)),
  );
}

export async function enqueueNotificationPushDispatch(
  adminSupabase: SupabaseClient,
  notificationId: string,
) {
  const { error } = await adminSupabase.from("notification_push_dispatch_queue").upsert(
    {
      available_at: new Date().toISOString(),
      attempt_count: 0,
      claim_token: null,
      claimed_at: null,
      last_error: null,
      notification_id: notificationId,
      status: "pending",
    },
    {
      onConflict: "notification_id",
    },
  );

  if (error) {
    logError("push/dispatch-queue", "push-dispatch-enqueue-failed", error, {
      notificationId,
    });
  }
  return error;
}

export async function claimNotificationPushDispatchBatch(adminSupabase: SupabaseClient) {
  return claimNotificationPushDispatchBatchWithLimit(adminSupabase, PUSH_DISPATCH_BATCH_LIMIT);
}

export async function claimNotificationPushDispatchBatchWithLimit(
  adminSupabase: SupabaseClient,
  limit: number,
) {
  const claimToken = crypto.randomUUID();
  const resolvedLimit = Math.max(1, Math.min(PUSH_DISPATCH_BATCH_LIMIT, Math.trunc(limit) || 1));
  const [{ data, error }, pendingCountResult, failedCountResult] = await Promise.all([
    adminSupabase.rpc("claim_notification_push_dispatch_batch", {
      p_claim_token: claimToken,
      p_lease_seconds: PUSH_DISPATCH_CLAIM_SECONDS,
      p_limit: resolvedLimit,
    }),
    adminSupabase
      .from("notification_push_dispatch_queue")
      .select("notification_id", { count: "exact", head: true })
      .eq("status", "pending"),
    adminSupabase
      .from("notification_push_dispatch_queue")
      .select("notification_id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  if (error) {
    logError("push/dispatch-queue", "push-dispatch-claim-batch-failed", error, {});
    return {
      claimToken,
      entries: [] as ClaimedPushDispatchEntry[],
      error,
    };
  }

  const entries = Array.isArray(data)
    ? data
        .map((row) => {
          const item = row as QueueRow;
          return {
            attemptCount: Number(item.attempt_count || 0),
            notificationId: String(item.notification_id || "").trim(),
          } satisfies ClaimedPushDispatchEntry;
        })
        .filter((item) => item.notificationId)
    : [];

  logInfo("push/dispatch-queue", "push-dispatch-claim-batch", {
    claimToken,
    claimedCount: entries.length,
    failedBacklogCount: failedCountResult.count || 0,
    limit: resolvedLimit,
    pendingBacklogCount: pendingCountResult.count || 0,
  });

  return {
    claimToken,
    entries,
    error: null,
  };
}

export async function completeNotificationPushDispatchBatch(params: {
  adminSupabase: SupabaseClient;
  claimToken: string;
  notificationIds: string[];
}) {
  if (params.notificationIds.length === 0) return null;
  const { error } = await params.adminSupabase
    .from("notification_push_dispatch_queue")
    .delete()
    .eq("claim_token", params.claimToken)
    .in("notification_id", params.notificationIds);

  if (error) {
    logError("push/dispatch-queue", "push-dispatch-complete-failed", error, {
      claimToken: params.claimToken,
      notificationCount: params.notificationIds.length,
    });
  }
  return error;
}

export async function retryNotificationPushDispatchBatch(params: {
  adminSupabase: SupabaseClient;
  claimToken: string;
  entries: Array<ClaimedPushDispatchEntry & { errorMessage: string }>;
}) {
  if (params.entries.length === 0) return null;

  const updates = await Promise.all(
    params.entries.map(async (entry) => {
      const nextAttemptCount = entry.attemptCount + 1;
      const exhausted = nextAttemptCount >= PUSH_DISPATCH_MAX_ATTEMPTS;
      const availableAt = exhausted
        ? new Date().toISOString()
        : new Date(Date.now() + clampRetryDelaySeconds(entry.attemptCount) * 1000).toISOString();
      const { error } = await params.adminSupabase
        .from("notification_push_dispatch_queue")
        .update({
          attempt_count: nextAttemptCount,
          available_at: availableAt,
          claim_token: null,
          claimed_at: null,
          last_error: String(entry.errorMessage || "").slice(0, 500) || null,
          status: exhausted ? "failed" : "pending",
        })
        .eq("claim_token", params.claimToken)
        .eq("notification_id", entry.notificationId);

      if (!error && exhausted) {
        logInfo("push/dispatch-queue", "push-dispatch-marked-failed", {
          attemptCount: nextAttemptCount,
          notificationId: entry.notificationId,
        });
      }
      return error;
    }),
  );

  const firstError = updates.find(Boolean) || null;
  if (firstError) {
    logError("push/dispatch-queue", "push-dispatch-retry-update-failed", firstError, {
      claimToken: params.claimToken,
      notificationCount: params.entries.length,
    });
  }
  return firstError;
}
