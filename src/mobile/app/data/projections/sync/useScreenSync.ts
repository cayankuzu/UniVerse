import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { logEvent, logScreenView, startObservedTimer } from "../../../platform/observability";

const NO_OP_REFRESH = () => undefined;

interface UseScreenSyncOptions {
  screenKey: string;
  enabled?: boolean;
  refresh?: () => Promise<void> | void;
  backgroundRefresh?: () => Promise<void> | void;
  criticalRefresh?: () => Promise<void> | void;
  deferredRefresh?: () => Promise<void> | void;
  autoRefreshOnFocus?: boolean;
  focusThrottleMs?: number;
  initialLastSyncedAt?: number;
  backgroundSkipIfFreshMs?: number;
  manualPendingMaxMs?: number;
  manualSkipIfFreshMs?: number;
  skipIfFreshMs?: number;
}

export function useScreenSync({
  screenKey,
  enabled = true,
  refresh,
  backgroundRefresh,
  criticalRefresh,
  deferredRefresh,
  autoRefreshOnFocus = false,
  focusThrottleMs = 1200,
  initialLastSyncedAt = 0,
  backgroundSkipIfFreshMs,
  manualPendingMaxMs = 0,
  manualSkipIfFreshMs,
  skipIfFreshMs = 0,
}: UseScreenSyncOptions) {
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => Math.max(0, initialLastSyncedAt));
  const refreshFnRef = useRef(criticalRefresh || refresh || NO_OP_REFRESH);
  const backgroundRefreshFnRef = useRef(deferredRefresh || backgroundRefresh);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const lastAutoRefreshRef = useRef(0);
  const lastAppStateRef = useRef(AppState.currentState);

  useEffect(() => {
    refreshFnRef.current = criticalRefresh || refresh || NO_OP_REFRESH;
  }, [criticalRefresh, refresh]);

  useEffect(() => {
    backgroundRefreshFnRef.current = deferredRefresh || backgroundRefresh;
  }, [backgroundRefresh, deferredRefresh]);

  useEffect(() => {
    const nextLastSyncedAt = Math.max(0, initialLastSyncedAt);
    setLastSyncedAt((current) => (current === nextLastSyncedAt ? current : nextLastSyncedAt));
    lastAutoRefreshRef.current = 0;
  }, [initialLastSyncedAt, screenKey]);

  const awaitWithPendingWindow = useCallback(
    async (params: {
      pendingMaxMs?: number;
      promise: Promise<void>;
      setPending: (value: boolean) => void;
    }) => {
      const pendingMaxMs = Math.max(0, Number(params.pendingMaxMs || 0));
      if (pendingMaxMs <= 0) {
        await params.promise;
        return;
      }

      let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const pendingResult = await Promise.race([
          params.promise.then(() => "completed" as const),
          new Promise<"timed-out">((resolve) => {
            pendingTimeoutId = setTimeout(() => resolve("timed-out"), pendingMaxMs);
          }),
        ]);
        if (pendingResult === "timed-out") {
          params.setPending(false);
          await params.promise;
        }
      } finally {
        if (pendingTimeoutId) {
          clearTimeout(pendingTimeoutId);
        }
      }
    },
    [],
  );

  const runSync = useCallback(
    async (params: {
      allowFreshSkip: boolean;
      name: "background-refresh" | "refresh";
      pendingMaxMs?: number;
      skipIfFreshMs: number;
      setPending: (value: boolean) => void;
      task: (() => Promise<void> | void) | null | undefined;
    }) => {
      const task = params.task;
      if (!enabled || !task) return;
      if (inFlightPromiseRef.current) {
        logEvent({
          category: "screen_sync",
          meta: { name: params.name },
          name: "refresh-joined-in-flight",
          screenKey,
          status: "ok",
        });
        params.setPending(true);
        try {
          await awaitWithPendingWindow({
            pendingMaxMs: params.pendingMaxMs,
            promise: inFlightPromiseRef.current,
            setPending: params.setPending,
          });
        } finally {
          params.setPending(false);
        }
        return;
      }
      const now = Date.now();
      if (
        params.allowFreshSkip &&
        params.skipIfFreshMs > 0 &&
        now - lastSyncedAt < params.skipIfFreshMs
      ) {
        logEvent({
          category: "screen_sync",
          meta: { name: params.name, skipIfFreshMs: params.skipIfFreshMs },
          name: "refresh-skipped-fresh",
          screenKey,
          status: "skipped",
        });
        return;
      }
      const startedAt = Date.now();
      const stopSyncTelemetry = startObservedTimer({
        category: "screen_sync",
        name: params.name,
        screenKey,
      });
      params.setPending(true);
      const syncPromise = (async () => {
        try {
          await task();
          setLastSyncedAt(Date.now());
          stopSyncTelemetry("ok");
          if (params.name === "background-refresh") {
            logScreenView({
              durationMs: Math.max(0, Date.now() - startedAt),
              meta: { name: params.name },
              name: "foreground_sync_latency",
              screenKey,
              status: "ok",
            });
          }
        } catch (error) {
          stopSyncTelemetry("error", {
            message: String((error as { message?: string })?.message || error || ""),
          });
          throw error;
        }
      })();
      inFlightPromiseRef.current = syncPromise;
      try {
        await awaitWithPendingWindow({
          pendingMaxMs: params.pendingMaxMs,
          promise: syncPromise,
          setPending: params.setPending,
        });
      } finally {
        inFlightPromiseRef.current = null;
        params.setPending(false);
      }
    },
    [awaitWithPendingWindow, enabled, lastSyncedAt, screenKey],
  );

  const runBackgroundRefresh = useCallback(async () => {
    await runSync({
      allowFreshSkip: true,
      name: "background-refresh",
      skipIfFreshMs: backgroundSkipIfFreshMs ?? skipIfFreshMs,
      setPending: setBackgroundRefreshing,
      task: backgroundRefreshFnRef.current || refreshFnRef.current,
    });
  }, [backgroundSkipIfFreshMs, runSync, skipIfFreshMs]);

  const runRefresh = useCallback(async () => {
    await runSync({
      allowFreshSkip: (manualSkipIfFreshMs ?? 0) > 0,
      name: "refresh",
      pendingMaxMs: manualPendingMaxMs,
      skipIfFreshMs: manualSkipIfFreshMs ?? 0,
      setPending: setRefreshing,
      task: refreshFnRef.current,
    });
  }, [manualPendingMaxMs, manualSkipIfFreshMs, runSync]);

  const triggerAutoRefresh = useCallback(() => {
    if (!enabled || !autoRefreshOnFocus || !isFocused) return;
    const now = Date.now();
    if (now - lastAutoRefreshRef.current < focusThrottleMs) return;
    lastAutoRefreshRef.current = now;
    void runBackgroundRefresh();
  }, [autoRefreshOnFocus, enabled, focusThrottleMs, isFocused, runBackgroundRefresh]);

  useEffect(() => {
    triggerAutoRefresh();
  }, [screenKey, triggerAutoRefresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const previousAppState = lastAppStateRef.current;
      lastAppStateRef.current = nextAppState;
      if (previousAppState === "active" || nextAppState !== "active") {
        return;
      }
      triggerAutoRefresh();
    });
    return () => {
      subscription.remove();
    };
  }, [triggerAutoRefresh]);

  return {
    backgroundRefreshing,
    lastSyncedAt,
    onBackgroundRefresh: runBackgroundRefresh,
    onRefresh: runRefresh,
    refreshing,
  };
}
