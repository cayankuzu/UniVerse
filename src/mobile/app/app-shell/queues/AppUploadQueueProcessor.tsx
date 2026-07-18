import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getUploadQueue } from "../../data/queues/uploadQueue";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { resumeRegisteredUploadQueues } from "./uploadQueueRegistry";
import { subscribeQueueResumeSignal } from "../../data/queues/runtimeSignals";
import { getStableQueueJitterMs, scheduleQueueProcessorResume } from "./queueResumeScheduler";
import { logEvent } from "../../platform/observability";

const IDLE_RESUME_DELAY_MS = 15_000;
const PENDING_RESUME_DELAY_MS = 4_000;
const INITIAL_RESUME_DELAY_MS = 1_800;
const ACTIVE_RESUME_DELAY_MS = 2_400;
const SIGNAL_RESUME_DELAY_MS = 900;
const RESUME_JITTER_WINDOW_MS = 480;

async function readUploadQueueStats(ownerId: string) {
  const queue = await getUploadQueue(undefined, ownerId);
  const now = Date.now();
  const pendingEntries = queue.filter(
    (entry) => entry.status === "pending" || entry.status === "uploading",
  );
  const oldestPendingAgeMs = pendingEntries.reduce((oldest, entry) => {
    const entryAgeMs = Math.max(0, now - new Date(entry.createdAt).getTime());
    return Math.max(oldest, entryAgeMs);
  }, 0);

  return {
    failedCount: queue.filter((entry) => entry.status === "failed").length,
    oldestPendingAgeMs,
    pendingCount: pendingEntries.length,
  };
}

export function AppUploadQueueProcessor() {
  const queryClient = useQueryClient();
  const { accountType, updateUserData, userData } = useAuth();
  const appStateRef = useRef(AppState.currentState);
  const resumeInFlightRef = useRef<Promise<void> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<{ cancel: () => void } | null>(null);
  const scheduledAllowInactiveRef = useRef(false);
  const scheduledResumeAtRef = useRef<number | null>(null);
  const viewerKey = getViewerKey(userData);

  useEffect(() => {
    const ownerId = userData.id;
    if (!ownerId) return;

    const clearFallbackTimer = () => {
      if (!fallbackTimerRef.current) return;
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    };

    const clearResumeTimer = () => {
      if (!resumeTimerRef.current) return;
      resumeTimerRef.current.cancel();
      resumeTimerRef.current = null;
      scheduledAllowInactiveRef.current = false;
      scheduledResumeAtRef.current = null;
    };

    const scheduleFallbackResume = async () => {
      clearFallbackTimer();
      const stats = await readUploadQueueStats(ownerId).catch(() => null);
      fallbackTimerRef.current = setTimeout(
        () => {
          void scheduleResume();
        },
        (stats?.pendingCount || 0) > 0 ? PENDING_RESUME_DELAY_MS : IDLE_RESUME_DELAY_MS,
      );
    };

    const resumeQueue = (allowInactive = false) => {
      if (!allowInactive && appStateRef.current !== "active") {
        return resumeInFlightRef.current;
      }
      if (resumeInFlightRef.current) {
        return resumeInFlightRef.current;
      }
      clearFallbackTimer();
      clearResumeTimer();
      const resumePromise = readUploadQueueStats(ownerId)
        .then((stats) => {
          logEvent({
            category: "upload",
            meta: {
              failedCount: stats.failedCount,
              oldestPendingAgeMs: stats.oldestPendingAgeMs,
              pendingCount: stats.pendingCount,
              trigger: allowInactive ? "forced-resume" : "active-resume",
            },
            name: "upload-queue-backlog",
            screenKey: ownerId,
            status: stats.pendingCount > 0 ? "ok" : "skipped",
          });
        })
        .catch(() => undefined)
        .then(() =>
          resumeRegisteredUploadQueues({
            accountType,
            ownerId,
            queryClient,
            updateUserData,
            userData,
            viewerKey,
          }),
        )
        .finally(async () => {
          if (resumeInFlightRef.current === resumePromise) {
            resumeInFlightRef.current = null;
          }
          await readUploadQueueStats(ownerId)
            .then((stats) => {
              logEvent({
                category: "upload",
                meta: {
                  failedCount: stats.failedCount,
                  oldestPendingAgeMs: stats.oldestPendingAgeMs,
                  pendingCount: stats.pendingCount,
                  trigger: "resume-finished",
                },
                name: "upload-queue-backlog",
                screenKey: ownerId,
                status: stats.pendingCount > 0 ? "rollback" : "ok",
              });
            })
            .catch(() => undefined);
          await scheduleFallbackResume();
        });
      resumeInFlightRef.current = resumePromise;
      return resumePromise;
    };

    const scheduleResume = (options?: { allowInactive?: boolean; baseDelayMs?: number }) => {
      if (resumeInFlightRef.current) return resumeInFlightRef.current;
      const allowInactive = options?.allowInactive ?? false;
      const delayMs =
        Math.max(0, options?.baseDelayMs ?? 0) +
        getStableQueueJitterMs(`${ownerId}:upload`, RESUME_JITTER_WINDOW_MS);
      const targetAt = Date.now() + delayMs;
      if (
        resumeTimerRef.current &&
        scheduledResumeAtRef.current !== null &&
        scheduledResumeAtRef.current <= targetAt &&
        (!allowInactive || scheduledAllowInactiveRef.current)
      ) {
        return resumeInFlightRef.current;
      }

      clearResumeTimer();
      scheduledAllowInactiveRef.current = allowInactive;
      scheduledResumeAtRef.current = targetAt;
      resumeTimerRef.current = scheduleQueueProcessorResume({
        callback: () => {
          const nextAllowInactive = scheduledAllowInactiveRef.current;
          clearResumeTimer();
          void resumeQueue(nextAllowInactive);
        },
        delayMs: Math.max(0, targetAt - Date.now()),
      });
      return resumeInFlightRef.current;
    };

    void scheduleResume({
      allowInactive: true,
      baseDelayMs: INITIAL_RESUME_DELAY_MS,
    });
    const unsubscribeSignal = subscribeQueueResumeSignal("upload", () => {
      void scheduleResume({
        allowInactive: true,
        baseDelayMs: SIGNAL_RESUME_DELAY_MS,
      });
    });
    const subscription = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active") {
        void scheduleResume({
          allowInactive: true,
          baseDelayMs: ACTIVE_RESUME_DELAY_MS,
        });
      }
    });

    return () => {
      clearFallbackTimer();
      clearResumeTimer();
      unsubscribeSignal();
      resumeInFlightRef.current = null;
      subscription.remove();
    };
  }, [accountType, queryClient, updateUserData, userData, userData.id, viewerKey]);

  return null;
}
