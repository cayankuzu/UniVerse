import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { QueueResumeChannel } from "../../data/queues/runtimeSignals";
import { subscribeQueueResumeSignal } from "../../data/queues/runtimeSignals";
import { logEvent } from "../../platform/observability";
import { getStableQueueJitterMs, scheduleQueueProcessorResume } from "./queueResumeScheduler";

export interface QueueBacklogStats {
  failedCount: number;
  oldestPendingAgeMs: number;
  pendingCount: number;
}

interface PersistentQueueProcessorParams {
  activeDelayMs: number;
  initialDelayMs: number;
  jitterWindowMs: number;
  lane: QueueResumeChannel;
  ownerId: string;
  pendingResumeDelayMs: number;
  readStats: () => Promise<QueueBacklogStats>;
  resume: () => Promise<void>;
  signalDelayMs: number;
}

export function usePersistentQueueProcessor(params: PersistentQueueProcessorParams) {
  const {
    activeDelayMs,
    initialDelayMs,
    jitterWindowMs,
    lane,
    ownerId,
    pendingResumeDelayMs,
    readStats,
    resume,
    signalDelayMs,
  } = params;
  const appStateRef = useRef(AppState.currentState);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeInFlightRef = useRef<Promise<void> | null>(null);
  const resumeTimerRef = useRef<{ cancel: () => void } | null>(null);
  const scheduledAllowInactiveRef = useRef(false);
  const scheduledResumeAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ownerId) return;

    // Every async hop below can outlive this effect (unmount or owner switch).
    // `disposed` is the generation token: once cleanup flips it, no continuation
    // may schedule work or emit telemetry for the owner this closure captured.
    let disposed = false;

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
      if (disposed) return;
      const stats = await readStats().catch(() => null);
      if (disposed || !stats?.pendingCount) return;
      fallbackTimerRef.current = setTimeout(() => {
        void scheduleResume();
      }, pendingResumeDelayMs);
    };

    const resumeQueue = (allowInactive = false) => {
      if (disposed) return null;
      if (!allowInactive && appStateRef.current !== "active") return resumeInFlightRef.current;
      if (resumeInFlightRef.current) return resumeInFlightRef.current;
      clearFallbackTimer();
      clearResumeTimer();

      const reportBacklog = (stats: QueueBacklogStats, trigger: string, finished = false) => {
        logEvent({
          category: lane,
          meta: {
            failedCount: stats.failedCount,
            oldestPendingAgeMs: stats.oldestPendingAgeMs,
            pendingCount: stats.pendingCount,
            trigger,
          },
          name: `${lane}-queue-backlog`,
          screenKey: "authenticated-owner",
          status:
            finished && stats.pendingCount > 0
              ? "rollback"
              : stats.pendingCount > 0
                ? "ok"
                : "skipped",
        });
      };

      const resumePromise = readStats()
        .then((stats) => reportBacklog(stats, allowInactive ? "forced-resume" : "active-resume"))
        .catch(() => undefined)
        .then(resume)
        .finally(async () => {
          if (resumeInFlightRef.current === resumePromise) resumeInFlightRef.current = null;
          if (disposed) return;
          await readStats()
            .then((stats) => {
              if (disposed) return;
              reportBacklog(stats, "resume-finished", true);
            })
            .catch(() => undefined);
          await scheduleFallbackResume();
        });
      resumeInFlightRef.current = resumePromise;
      return resumePromise;
    };

    const scheduleResume = (options?: { allowInactive?: boolean; baseDelayMs?: number }) => {
      if (disposed) return null;
      if (resumeInFlightRef.current) return resumeInFlightRef.current;
      const allowInactive = options?.allowInactive ?? false;
      const delayMs =
        Math.max(0, options?.baseDelayMs ?? 0) +
        getStableQueueJitterMs(`${ownerId}:${lane}`, jitterWindowMs);
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
          if (disposed) return;
          const nextAllowInactive = scheduledAllowInactiveRef.current;
          clearResumeTimer();
          void resumeQueue(nextAllowInactive);
        },
        delayMs: Math.max(0, targetAt - Date.now()),
      });
      return resumeInFlightRef.current;
    };

    void scheduleResume({ allowInactive: true, baseDelayMs: initialDelayMs });
    const unsubscribeSignal = subscribeQueueResumeSignal(lane, () => {
      void scheduleResume({ allowInactive: true, baseDelayMs: signalDelayMs });
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active") {
        void scheduleResume({ allowInactive: true, baseDelayMs: activeDelayMs });
      }
    });

    return () => {
      disposed = true;
      clearFallbackTimer();
      clearResumeTimer();
      unsubscribeSignal();
      resumeInFlightRef.current = null;
      appStateSubscription.remove();
    };
  }, [
    activeDelayMs,
    initialDelayMs,
    jitterWindowMs,
    lane,
    ownerId,
    pendingResumeDelayMs,
    readStats,
    resume,
    signalDelayMs,
  ]);
}
