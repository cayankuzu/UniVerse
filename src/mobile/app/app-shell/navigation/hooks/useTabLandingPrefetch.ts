import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import {
  getCachedWarmupPreferences,
  loadPersistedWarmupPreferences,
  persistWarmupLandingVisit,
  rankWarmupLandingSurfaces,
  type WarmupLandingSurface,
} from "../../../data/projections/warmupPreferences";
import { resolveNetworkBudget } from "../../../data/projections/networkAwareBudget";
import { getRuntimePerformanceTier } from "../../../shared/performance/runtimePerformanceTier";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";

const FIRST_LANDING_WARMUP_DELAY_MS = 180;
const NEXT_LANDING_WARMUP_DELAY_MS = 320;
const warmedLandingModules = new Set<WarmupLandingSurface>();

function warmLandingModule(surface: WarmupLandingSurface) {
  if (warmedLandingModules.has(surface)) return;

  try {
    if (surface === "search") {
      require("../navigators/stacks/SearchStackNavigator");
    } else if (surface === "profile") {
      require("../navigators/stacks/ProfileStackNavigator");
    } else {
      require("../../../features/notifications/public/screens");
    }
    warmedLandingModules.add(surface);
  } catch {
    warmedLandingModules.delete(surface);
  }
}

function resolveLandingSurface(routeName?: string | null): WarmupLandingSurface | null {
  if (routeName === "Search") return "search";
  if (routeName === "Profile") return "profile";
  if (routeName === "Notifications") return "notifications";
  return null;
}

function resolveWarmupTargetLimit() {
  const tier = getRuntimePerformanceTier();
  if (tier === "tier3") return 1;
  if (tier === "tier2") return 2;
  return 3;
}

function isAppForegroundForWarmup() {
  return AppState.currentState !== "background" && AppState.currentState !== "inactive";
}

export function useTabLandingPrefetch(params: {
  activeRoute?: string | null;
  enabled: boolean;
  userId?: string | null;
  username?: string | null;
}) {
  const queryClient = useQueryClient();
  const lastObservedRouteRef = useRef("");
  const viewerKey = getViewerKey({ id: params.userId, username: params.username });
  const username = String(params.username || "").trim();

  useEffect(() => {
    if (!params.enabled || !username) return;

    let cancelled = false;
    let scheduledTask: { cancel: () => void } | null = null;

    const scheduleNextModule = (surfaces: WarmupLandingSurface[], index: number) => {
      if (cancelled || index >= surfaces.length) return;
      const delayMs = index === 0 ? FIRST_LANDING_WARMUP_DELAY_MS : NEXT_LANDING_WARMUP_DELAY_MS;
      scheduledTask = scheduleAfterInteractions(() => {
        if (cancelled || !isAppForegroundForWarmup()) return;
        warmLandingModule(surfaces[index]);
        scheduleNextModule(surfaces, index + 1);
      }, delayMs);
    };

    void loadPersistedWarmupPreferences(viewerKey)
      .catch(() => null)
      .then((preferences) => {
        if (cancelled) return;
        const surfaces = rankWarmupLandingSurfaces(preferences?.landingAffinity).slice(
          0,
          resolveWarmupTargetLimit(),
        );
        scheduleNextModule(surfaces, 0);
      });

    return () => {
      cancelled = true;
      scheduledTask?.cancel();
    };
  }, [params.enabled, username, viewerKey]);

  useEffect(() => {
    const activeRoute = String(params.activeRoute || "");
    if (!params.enabled || !username) {
      lastObservedRouteRef.current = "";
      return;
    }
    const routeVisitKey = `${viewerKey}:${activeRoute}`;
    if (routeVisitKey === lastObservedRouteRef.current) return;
    lastObservedRouteRef.current = routeVisitKey;
    const surface = resolveLandingSurface(activeRoute);
    if (!surface) return;
    void persistWarmupLandingVisit(viewerKey, surface).catch(() => undefined);
  }, [params.activeRoute, params.enabled, username, viewerKey]);

  const prefetchTabIntent = useCallback(
    (surface: "profile" | "search") => {
      warmLandingModule(surface);
      if (!params.enabled || !username || !resolveNetworkBudget("active").allowIntentPrefetch) {
        return;
      }

      const preferences = getCachedWarmupPreferences(viewerKey);
      const viewer = { id: params.userId || undefined, username };
      if (surface === "search") {
        const {
          prefetchSearchLandingExperience,
        } = require("../../../features/search/public/prefetch");
        void prefetchSearchLandingExperience({
          preferredScope: preferences.lastSearchScope,
          queryClient,
          source: "intent",
          viewer,
        });
        return;
      }

      const {
        prefetchOwnProfileLandingExperience,
      } = require("../../../features/profile/public/prefetch");
      void prefetchOwnProfileLandingExperience({
        preferredTab: preferences.lastProfileTab || "album",
        queryClient,
        source: "intent",
        viewer,
      });
    },
    [params.enabled, params.userId, queryClient, username, viewerKey],
  );

  return { prefetchTabIntent };
}
