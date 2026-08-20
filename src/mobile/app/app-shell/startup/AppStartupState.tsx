import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useIsRestoring, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { logScreenView, startObservedTimer } from "../../platform/observability";
import { STARTUP_PERFORMANCE_BUDGET } from "../../data/projections/performanceBudget";
import { primeHomeStartupSnapshotsIntoQueryCache } from "../../features/home/public/warmup";
import { hydrateStartupCaches } from "../bootstrap/appBootstrap";

interface AppStartupStateValue {
  queryCacheReady: boolean;
  queryRestoreReady: boolean;
}

const AppStartupStateContext = createContext<AppStartupStateValue | null>(null);

/** Maximum time the splash screen waits for first-fold data. */
const SPLASH_MAX_WAIT_MS = STARTUP_PERFORMANCE_BUDGET.splashMaxWaitMs;

interface AppStartupStateProviderProps {
  children: React.ReactNode;
}

type FirstFoldSource = "empty-cache" | "query-cache" | "startup-snapshot";
type StartupPhaseTimer = ReturnType<typeof startObservedTimer>;

function stopStartupPhaseTimer(
  timerRef: React.MutableRefObject<StartupPhaseTimer | null>,
  status: "ok" | "rollback" | "skipped",
  meta?: Record<string, unknown>,
) {
  timerRef.current?.(status, meta);
  timerRef.current = null;
}

function resolveFallbackFirstFoldSource(queryClient: QueryClient): FirstFoldSource {
  return queryClient
    .getQueriesData({ queryKey: ["screen", "home"] })
    .some(([, data]) => Boolean(data))
    ? "query-cache"
    : "empty-cache";
}

export function AppStartupStateProvider({ children }: AppStartupStateProviderProps) {
  const queryClient = useQueryClient();
  const queryRestoreReady = !useIsRestoring();
  const [queryRestoreTimedOut, setQueryRestoreTimedOut] = useState(false);
  const [mediaCacheReady, setMediaCacheReady] = useState(false);
  const [snapshotPrimeReady, setSnapshotPrimeReady] = useState(false);
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const firstFoldSourceRef = useRef<FirstFoldSource>("empty-cache");
  const gateOpenLoggedRef = useRef(false);
  const mediaCacheTimerRef = useRef<StartupPhaseTimer | null>(
    startObservedTimer({
      category: "screen",
      meta: { phase: "f0-media-cache" },
      name: "startup_phase:media_cache",
      screenKey: "app-startup",
    }),
  );
  const queryRestoreTimerRef = useRef<StartupPhaseTimer | null>(
    startObservedTimer({
      category: "screen",
      meta: { phase: "f0-query-cache" },
      name: "startup_phase:query_cache_restore",
      screenKey: "app-startup",
    }),
  );
  const firstFoldReadyTimerRef = useRef<StartupPhaseTimer | null>(
    startObservedTimer({
      category: "screen",
      meta: { phase: "f1-first-fold" },
      name: "startup_phase:first_fold_ready",
      screenKey: "app-startup",
    }),
  );

  const queryRestoreGateReady = queryRestoreReady || queryRestoreTimedOut;
  const firstFoldReady = queryRestoreGateReady && (snapshotPrimeReady || splashTimedOut);

  useEffect(() => {
    if (queryRestoreReady) return;
    const timer = setTimeout(() => {
      setQueryRestoreTimedOut(true);
    }, STARTUP_PERFORMANCE_BUDGET.queryRestoreMaxWaitMs);
    return () => clearTimeout(timer);
  }, [queryRestoreReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashTimedOut(true);
    }, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStartupCaches().finally(() => {
      if (!cancelled) {
        setMediaCacheReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mediaCacheReady) return;
    stopStartupPhaseTimer(mediaCacheTimerRef, "ok");
  }, [mediaCacheReady]);

  useEffect(() => {
    if (!queryRestoreGateReady) return;
    stopStartupPhaseTimer(queryRestoreTimerRef, queryRestoreTimedOut ? "rollback" : "ok", {
      restoreCompleted: queryRestoreReady,
      timedOut: queryRestoreTimedOut,
    });
  }, [queryRestoreGateReady, queryRestoreReady, queryRestoreTimedOut]);

  useEffect(() => {
    if (!queryRestoreGateReady) {
      setSnapshotPrimeReady(false);
      firstFoldSourceRef.current = "empty-cache";
      return;
    }
    const restoredSource = resolveFallbackFirstFoldSource(queryClient);
    if (restoredSource === "query-cache") {
      firstFoldSourceRef.current = restoredSource;
      setSnapshotPrimeReady(true);
      void primeHomeStartupSnapshotsIntoQueryCache(queryClient).catch(() => undefined);
      return;
    }
    let cancelled = false;
    void primeHomeStartupSnapshotsIntoQueryCache(queryClient)
      .then((result) => {
        if (cancelled) return;
        firstFoldSourceRef.current = result.source;
        setSnapshotPrimeReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        firstFoldSourceRef.current = resolveFallbackFirstFoldSource(queryClient);
        setSnapshotPrimeReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient, queryRestoreGateReady]);

  useEffect(() => {
    if (!firstFoldReady || gateOpenLoggedRef.current) return;
    gateOpenLoggedRef.current = true;
    stopStartupPhaseTimer(firstFoldReadyTimerRef, "ok", {
      source: firstFoldSourceRef.current,
    });
    logScreenView({
      meta: {
        phase: "f1-first-fold",
        source: firstFoldSourceRef.current,
        splashTimedOut,
      },
      name: "startup_phase:first_fold_gate_open",
      screenKey: "app-startup",
      status: splashTimedOut ? "rollback" : "ok",
    });
    logScreenView({
      meta: {
        phase: "f1-first-fold",
        source: firstFoldSourceRef.current,
      },
      name: "startup_phase:first_fold_source",
      screenKey: "app-startup",
      status: firstFoldSourceRef.current === "empty-cache" ? "skipped" : "ok",
    });
  }, [firstFoldReady, splashTimedOut]);

  const value = useMemo(
    () => ({
      queryCacheReady: firstFoldReady,
      queryRestoreReady,
    }),
    [firstFoldReady, queryRestoreReady],
  );

  return (
    <AppStartupStateContext.Provider value={value}>{children}</AppStartupStateContext.Provider>
  );
}

export function useAppStartupState() {
  const context = useContext(AppStartupStateContext);
  if (!context) {
    throw new Error("useAppStartupState must be used within an AppStartupStateProvider");
  }
  return context;
}
