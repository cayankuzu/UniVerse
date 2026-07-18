import { logError, logInfo } from "../logging.ts";
import type { ServerRouteDeps } from "../types.ts";
import {
  claimNotificationPushDispatchBatchWithLimit,
  completeNotificationPushDispatchBatch,
  retryNotificationPushDispatchBatch,
} from "./pushDispatchQueue.ts";
import { processNotificationPushDispatch } from "./pushDispatchProcessor.ts";

const PUSH_DISPATCH_MAX_DRAIN_PASSES = 3;
const INLINE_PUSH_DRAIN_MIN_INTERVAL_MS = 1_500;

let pendingInlineDrainPromise: Promise<Awaited<
  ReturnType<typeof drainNotificationPushDispatchQueue>
> | null> | null = null;
let lastInlineDrainAt = 0;

export async function drainNotificationPushDispatchQueue(params: {
  adminSupabase: Pick<ServerRouteDeps, "adminSupabase">["adminSupabase"];
  batchLimit?: number;
  maxPasses?: number;
}) {
  const { adminSupabase, batchLimit, maxPasses = PUSH_DISPATCH_MAX_DRAIN_PASSES } = params;
  let failedCount = 0;
  let processedCount = 0;
  let retryCount = 0;
  let sentCount = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const claimedBatch = await claimNotificationPushDispatchBatchWithLimit(
      adminSupabase,
      batchLimit ?? Number.MAX_SAFE_INTEGER,
    );
    if (claimedBatch.error) {
      return {
        error: claimedBatch.error,
        failedCount,
        processedCount,
        retryCount,
        sentCount,
      };
    }
    if (claimedBatch.entries.length === 0) {
      break;
    }

    const completedIds: string[] = [];
    const retryEntries: Array<{
      attemptCount: number;
      errorMessage: string;
      notificationId: string;
    }> = [];

    for (const entry of claimedBatch.entries) {
      const result = await processNotificationPushDispatch({
        adminSupabase,
        notificationId: entry.notificationId,
      });
      processedCount += 1;
      failedCount += result.failedCount;
      sentCount += result.sentCount;
      if (result.status === "retry") {
        retryEntries.push({
          attemptCount: entry.attemptCount,
          errorMessage: result.errorMessage || "push-dispatch-retry-requested",
          notificationId: entry.notificationId,
        });
        retryCount += 1;
        continue;
      }
      completedIds.push(entry.notificationId);
    }

    const [completeError, retryError] = await Promise.all([
      completeNotificationPushDispatchBatch({
        adminSupabase,
        claimToken: claimedBatch.claimToken,
        notificationIds: completedIds,
      }),
      retryNotificationPushDispatchBatch({
        adminSupabase,
        claimToken: claimedBatch.claimToken,
        entries: retryEntries,
      }),
    ]);
    if (completeError || retryError) {
      return {
        error: completeError || retryError,
        failedCount,
        processedCount,
        retryCount,
        sentCount,
      };
    }
  }

  return {
    error: null,
    failedCount,
    processedCount,
    retryCount,
    sentCount,
  };
}

export async function triggerInlinePushDispatchDrain(params: {
  adminSupabase: Pick<ServerRouteDeps, "adminSupabase">["adminSupabase"];
  batchLimit?: number;
  maxPasses?: number;
  requestPath: string;
}) {
  const { adminSupabase, batchLimit, maxPasses = 1, requestPath } = params;
  const now = Date.now();

  if (pendingInlineDrainPromise) {
    return pendingInlineDrainPromise;
  }
  if (now - lastInlineDrainAt < INLINE_PUSH_DRAIN_MIN_INTERVAL_MS) {
    return null;
  }

  const drainTask = (async () => {
    const { count, error: countError } = await adminSupabase
      .from("notification_push_dispatch_queue")
      .select("notification_id", { count: "exact", head: true })
      .eq("status", "pending");

    if (countError) {
      logError("push/dispatch-inline", "push-dispatch-inline-count-failed", countError, {
        requestPath,
      });
      return null;
    }
    if (!count || count <= 0) {
      return null;
    }

    const drainResult = await drainNotificationPushDispatchQueue({
      adminSupabase,
      batchLimit,
      maxPasses,
    });
    if (drainResult.error) {
      logError("push/dispatch-inline", "push-dispatch-inline-drain-failed", drainResult.error, {
        pendingCount: count,
        requestPath,
      });
      return drainResult;
    }

    if (drainResult.processedCount > 0) {
      lastInlineDrainAt = Date.now();
      logInfo("push/dispatch-inline", "push-dispatch-inline-drain-finished", {
        failedCount: drainResult.failedCount,
        pendingCount: count,
        processedCount: drainResult.processedCount,
        requestPath,
        retryCount: drainResult.retryCount,
        sentCount: drainResult.sentCount,
      });
    }

    return drainResult;
  })().finally(() => {
    pendingInlineDrainPromise = null;
  });

  pendingInlineDrainPromise = drainTask;
  return drainTask;
}
