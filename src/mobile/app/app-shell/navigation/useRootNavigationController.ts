import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountType } from "../../data/contracts/api";
import { startObservedTimer } from "../../platform/observability";
import { noteInteractionActive } from "../../shared/performance/interactionGate";
import { resolveRootTab, shouldShowRootTabs, type RootTabName } from "./rootNavigation.constants";
import { navigateToRoute, resolveActiveRouteName } from "./navigationTargets";
import type { RootNavigatorParamList } from "./types";
import { useExitIntentGuard } from "./useExitIntentGuard";

type UseRootNavigationControllerParams = {
  accountType: AccountType;
  isLoading: boolean;
  isLoggedIn: boolean;
  navigationRef: NavigationContainerRefWithCurrent<RootNavigatorParamList>;
  setBottomTabsVisible: (visible: boolean) => void;
  triggerTabReselect?: (tab: "home" | "profile" | "search") => void;
};

type TabLeafRoute = "Home" | "Profile" | "Search";
type NavigationTransitionStatus = "ok" | "rollback" | "skipped";

function isTabLeafRoute(routeName: string): routeName is TabLeafRoute {
  return routeName === "Home" || routeName === "Profile" || routeName === "Search";
}

function resolveControllerDisplayRoute(params: {
  currentRoute: string;
  isLoggedIn: boolean;
  optimisticRoute: string;
}) {
  if (params.optimisticRoute) return params.optimisticRoute;
  if (params.currentRoute) return params.currentRoute;
  return params.isLoggedIn ? "Home" : "Welcome";
}

function resolveCurrentRouteName(
  navigationRef: NavigationContainerRefWithCurrent<RootNavigatorParamList>,
  fallbackRoute = "",
) {
  return (
    resolveActiveRouteName(navigationRef.getRootState()) ||
    navigationRef.getCurrentRoute()?.name ||
    fallbackRoute
  );
}

function pushTabHistory(nextHistory: TabLeafRoute[], routeName: TabLeafRoute) {
  if (nextHistory[nextHistory.length - 1] === routeName) return;
  nextHistory.push(routeName);
  if (nextHistory.length > 12) {
    nextHistory.shift();
  }
}

function popPreviousTabRoute(tabHistory: TabLeafRoute[], activeRouteName: TabLeafRoute) {
  let previousTabRoute = tabHistory.pop() || null;
  while (previousTabRoute === activeRouteName && tabHistory.length > 0) {
    previousTabRoute = tabHistory.pop() || null;
  }
  if (!previousTabRoute || previousTabRoute === activeRouteName) {
    return null;
  }
  return previousTabRoute;
}

export function useRootNavigationController({
  accountType,
  isLoading,
  isLoggedIn,
  navigationRef,
  setBottomTabsVisible,
  triggerTabReselect,
}: UseRootNavigationControllerParams) {
  const [currentRoute, setCurrentRoute] = useState("");
  const [optimisticRoute, setOptimisticRoute] = useState("");
  const pendingTabBackRoute = useRef<"Home" | "Profile" | "Search" | null>(null);
  const pendingTransitionRef = useRef<{
    route: string;
    stop: ReturnType<typeof startObservedTimer>;
  } | null>(null);
  const tabHistoryRef = useRef<TabLeafRoute[]>([]);
  const lastTrackedRouteRef = useRef("");
  const { confirmExit, exitMessage, resetExitIntent } = useExitIntentGuard();
  const displayRoute = resolveControllerDisplayRoute({
    currentRoute,
    isLoggedIn,
    optimisticRoute,
  });

  const stopPendingTransition = useCallback(
    (status: NavigationTransitionStatus, meta?: Record<string, unknown>) => {
      pendingTransitionRef.current?.stop(status, meta);
      pendingTransitionRef.current = null;
    },
    [],
  );

  useEffect(() => {
    setBottomTabsVisible(displayRoute !== "CreateEvent");
  }, [displayRoute, setBottomTabsVisible]);

  useEffect(() => {
    if (!pendingTransitionRef.current?.route) {
      resetExitIntent();
      setOptimisticRoute("");
      return;
    }
    stopPendingTransition("skipped", {
      reason: "auth-state-change",
      targetRoute: pendingTransitionRef.current.route,
    });
    resetExitIntent();
    setOptimisticRoute("");
  }, [isLoggedIn, resetExitIntent, stopPendingTransition]);

  const updateCurrentRoute = useCallback(() => {
    const activeRouteName = resolveCurrentRouteName(navigationRef);
    const previousRouteName = lastTrackedRouteRef.current;
    const previousTabRoute = isTabLeafRoute(previousRouteName) ? previousRouteName : null;
    const activeTabRoute = isTabLeafRoute(activeRouteName) ? activeRouteName : null;
    const isResolvedTabBack =
      Boolean(activeTabRoute) && pendingTabBackRoute.current === activeTabRoute;

    if (
      previousTabRoute &&
      activeTabRoute &&
      previousTabRoute !== activeTabRoute &&
      !isResolvedTabBack
    ) {
      pushTabHistory(tabHistoryRef.current, previousTabRoute);
    }

    if (isResolvedTabBack) {
      pendingTabBackRoute.current = null;
    }

    if (activeRouteName !== previousRouteName) {
      resetExitIntent();
    }
    lastTrackedRouteRef.current = activeRouteName;
    setCurrentRoute((previous) => (previous === activeRouteName ? previous : activeRouteName));
    if (pendingTransitionRef.current?.route === activeRouteName) {
      stopPendingTransition("ok", {
        route: activeRouteName,
      });
    }
    setOptimisticRoute("");
  }, [navigationRef, resetExitIntent, stopPendingTransition]);

  useEffect(
    () => () => {
      if (!pendingTransitionRef.current?.route) return;
      stopPendingTransition("skipped", {
        reason: "unmount",
        targetRoute: pendingTransitionRef.current.route,
      });
    },
    [stopPendingTransition],
  );

  const beginRouteTransition = useCallback(
    (targetRoute: string, trigger: string) => {
      noteInteractionActive(240);
      stopPendingTransition("rollback", {
        nextTargetRoute: targetRoute,
        reason: "replaced",
        trigger,
      });
      pendingTransitionRef.current = {
        route: targetRoute,
        stop: startObservedTimer({
          category: "screen",
          meta: {
            fromRoute: displayRoute,
            targetRoute,
            trigger,
          },
          name: "navigation_transition_latency",
          screenKey: `nav:${targetRoute}`,
        }),
      };
      setOptimisticRoute(targetRoute);
    },
    [displayRoute, stopPendingTransition],
  );

  const navigateOrReselect = useCallback(
    (routeName: TabLeafRoute, tab: "home" | "profile" | "search") => {
      if (!navigationRef.isReady()) return;
      if (pendingTransitionRef.current?.route === routeName) return;
      if (displayRoute === routeName) {
        triggerTabReselect?.(tab);
        return;
      }
      beginRouteTransition(routeName, `tab:${tab}`);
      navigateToRoute(navigationRef, routeName);
    },
    [beginRouteTransition, displayRoute, navigationRef, triggerTabReselect],
  );

  const handleHomePress = useCallback(() => {
    navigateOrReselect("Home", "home");
  }, [navigateOrReselect]);

  const handleSearchPress = useCallback(() => {
    navigateOrReselect("Search", "search");
  }, [navigateOrReselect]);

  const handleProfilePress = useCallback(() => {
    navigateOrReselect("Profile", "profile");
  }, [navigateOrReselect]);

  const handleCreatePress = useCallback(() => {
    if (!navigationRef.isReady()) return;
    if (pendingTransitionRef.current?.route === "CreateEvent") return;
    beginRouteTransition("CreateEvent", "fab:create-event");
    navigateToRoute(navigationRef, "CreateEvent");
  }, [beginRouteTransition, navigationRef]);

  const handleHardwareBack = useCallback(() => {
    if (!navigationRef.isReady()) return false;
    if (navigationRef.canGoBack()) {
      resetExitIntent();
      navigationRef.goBack();
      return true;
    }

    const activeRouteName = resolveCurrentRouteName(navigationRef, displayRoute);
    if (!isTabLeafRoute(activeRouteName)) {
      return confirmExit();
    }

    const previousTabRoute = popPreviousTabRoute(tabHistoryRef.current, activeRouteName);
    if (!previousTabRoute) {
      return confirmExit();
    }

    pendingTabBackRoute.current = previousTabRoute;
    resetExitIntent();
    beginRouteTransition(previousTabRoute, "hardware-back");
    navigateToRoute(navigationRef, previousTabRoute);
    return true;
  }, [beginRouteTransition, confirmExit, displayRoute, navigationRef, resetExitIntent]);

  const currentTab = useMemo<RootTabName>(() => resolveRootTab(displayRoute), [displayRoute]);
  const showAppTabs = shouldShowRootTabs({
    currentRoute: displayRoute,
    isLoading,
    isLoggedIn,
  });

  return useMemo(
    () => ({
      accountType,
      currentRoute,
      currentTab,
      exitMessage,
      handleCreatePress,
      handleHomePress,
      handleHardwareBack,
      handleProfilePress,
      handleReady: updateCurrentRoute,
      handleSearchPress,
      handleStateChange: updateCurrentRoute,
      showAppTabs,
    }),
    [
      accountType,
      currentRoute,
      currentTab,
      exitMessage,
      handleCreatePress,
      handleHardwareBack,
      handleHomePress,
      handleProfilePress,
      handleSearchPress,
      showAppTabs,
      updateCurrentRoute,
    ],
  );
}
