import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getViewerKey } from "../../data/contracts/viewerKey";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { logError } from "../../platform/observability";
import { useAppStartupState } from "./AppStartupState";
import { runAppWarmupIdleTasks, seedAppWarmupBundle } from "./appWarmupRuntime";
import { type WarmupFailurePhase, type WarmupReason, WARMUP_STALE_MS } from "./appWarmup.shared";

export function AppDataWarmup() {
  const queryClient = useQueryClient();
  const { isLoggedIn, isDemoMode, userData } = useAuth();
  const { queryRestoreReady } = useAppStartupState();
  const warmedViewerRef = useRef("");
  const prefetchedImageUrisRef = useRef(new Set<string>());
  const lastWarmupAtRef = useRef(0);
  const idleCancelRef = useRef<(() => void) | null>(null);
  const warmupPromiseRef = useRef<Promise<void> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const viewerKey = getViewerKey(userData);
  const viewerId = String(userData.id || "").trim();
  const viewerUsername = String(userData.username || "")
    .trim()
    .toLowerCase();
  const canWarmup =
    queryRestoreReady &&
    isLoggedIn &&
    !isDemoMode &&
    Boolean(userData.id) &&
    Boolean(viewerUsername);
  const viewerWarmupKey = canWarmup ? `${viewerKey}:${viewerUsername}` : "";

  const reportWarmupFailure = useCallback(
    (phase: WarmupFailurePhase, error: unknown) => {
      logError(error, {
        captureInSentry: false,
        meta: {
          phase,
          scope: "app-warmup",
        },
        name: "app-warmup-non-blocking-error",
        screenKey: viewerKey,
      });
    },
    [viewerKey],
  );

  const cancelIdleWarmup = useCallback(() => {
    idleCancelRef.current?.();
    idleCancelRef.current = null;
  }, []);

  const resetWarmupCaches = useCallback(() => {
    prefetchedImageUrisRef.current.clear();
    lastWarmupAtRef.current = 0;
  }, []);

  const resetWarmupState = useCallback(() => {
    warmedViewerRef.current = "";
    resetWarmupCaches();
    cancelIdleWarmup();
    warmupPromiseRef.current = null;
  }, [cancelIdleWarmup, resetWarmupCaches]);

  const runIdleWarmup = useCallback(
    (bundle: AppWarmupBundle) =>
      runAppWarmupIdleTasks({
        appStateRef,
        bundle,
        prefetchedImageUrisRef,
        viewerKey,
      }),
    [viewerKey],
  );

  const seedWarmupBundle = useCallback(
    async (reason: "foreground-stale" | "startup") => {
      const result = await seedAppWarmupBundle({
        prefetchedImageUris: prefetchedImageUrisRef.current,
        queryClient,
        reason,
        reportWarmupFailure: (phase, error) => reportWarmupFailure(phase, error),
        runIdleWarmup,
        viewerId: viewerId || undefined,
        viewerKey,
        viewerUsername,
      });
      lastWarmupAtRef.current = result.warmedAt;
      return result.cancelIdleTask;
    },
    [queryClient, reportWarmupFailure, runIdleWarmup, viewerId, viewerKey, viewerUsername],
  );

  const runWarmup = useCallback(
    (reason: WarmupReason) => {
      if (!canWarmup) {
        return Promise.resolve();
      }
      if (warmupPromiseRef.current) {
        return warmupPromiseRef.current;
      }
      if (reason === "foreground-stale") {
        resetWarmupCaches();
      }
      const warmupPromise = (async () => {
        try {
          const cancelIdleTask = await seedWarmupBundle(reason);
          cancelIdleWarmup();
          idleCancelRef.current = cancelIdleTask || null;
        } catch (error) {
          reportWarmupFailure(reason, error);
        } finally {
          warmupPromiseRef.current = null;
        }
      })();
      warmupPromiseRef.current = warmupPromise;
      return warmupPromise;
    },
    [canWarmup, cancelIdleWarmup, reportWarmupFailure, resetWarmupCaches, seedWarmupBundle],
  );

  useEffect(() => {
    if (!canWarmup) {
      resetWarmupState();
      return;
    }

    const now = Date.now();
    if (warmedViewerRef.current && warmedViewerRef.current !== viewerWarmupKey) {
      resetWarmupCaches();
    }
    if (
      warmedViewerRef.current === viewerWarmupKey &&
      now - lastWarmupAtRef.current < WARMUP_STALE_MS
    ) {
      return;
    }
    warmedViewerRef.current = viewerWarmupKey;
    void runWarmup("startup");

    return () => {
      cancelIdleWarmup();
    };
  }, [
    canWarmup,
    cancelIdleWarmup,
    resetWarmupCaches,
    resetWarmupState,
    runWarmup,
    viewerWarmupKey,
  ]);

  useEffect(() => {
    if (!canWarmup) {
      return;
    }
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== "active" || previousState === "active") {
        return;
      }
      if (!warmedViewerRef.current || warmedViewerRef.current !== viewerWarmupKey) {
        return;
      }
      if (Date.now() - lastWarmupAtRef.current < WARMUP_STALE_MS) {
        return;
      }
      void runWarmup("foreground-stale");
    });
    return () => {
      cancelIdleWarmup();
      subscription.remove();
    };
  }, [canWarmup, cancelIdleWarmup, runWarmup, viewerWarmupKey]);

  return null;
}
