import React from "react";
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { BackHandler, View } from "react-native";
import { useAuth } from "../auth";
import { OnboardingCoordinator } from "../onboarding";
import { AppNetworkStatusBanner } from "../feedback/AppNetworkStatusBanner";
import { AppUploadActivityBar } from "../feedback/AppUploadActivityBar";
import { useAppStartupState } from "../startup/AppStartupState";
import { StartupSplashScreen } from "../startup/StartupSplashScreen";
import { hideNativeSplashScreen } from "../startup/nativeSplash";
import { usePushNotificationResponseBridge } from "../bridges/usePushNotificationResponseBridge";
import { useBottomTabsVisible, useSetBottomTabsVisible } from "./ChromeVisibilityContext";
import { useTriggerTabReselect } from "./TabReselectContext";
import { rootNavigationLinking } from "./rootNavigation.linking";
import { RootNavigatorScreens } from "./rootNavigationScreens";
import type { RootNavigatorParamList } from "./types";
import { useRootNavigationController } from "./useRootNavigationController";
import { useTabLandingPrefetch } from "./hooks/useTabLandingPrefetch";
import { MainBottomTabs } from "./components/MainBottomTabs";
import { useSupabaseDeepLinkBridge } from "./bridges/useSupabaseDeepLinkBridge";
import { appTheme } from "../../shared/theme";
import { FeedToast } from "../../shared/components";
import { registerNavigationContainer } from "../../platform/observability";

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: appTheme.colors.background,
    border: appTheme.colors.outline,
    card: appTheme.colors.surface,
    notification: appTheme.colors.error,
    primary: appTheme.colors.primary,
    text: appTheme.colors.onSurface,
  },
};

function isAuthenticatedBootState(value: ReturnType<typeof useAuth>["authBootState"]) {
  return value === "signed_in_seeded" || value === "signed_in_hydrated";
}

export function RootNavigator() {
  const { accountType, authBootState, isAuthBootstrapPending, isLoading, isLoggedIn, userData } =
    useAuth();
  const { queryCacheReady } = useAppStartupState();
  const bottomTabsVisible = useBottomTabsVisible();
  const setBottomTabsVisible = useSetBottomTabsVisible();
  const triggerTabReselect = useTriggerTabReselect();
  const navigationRef = useNavigationContainerRef<RootNavigatorParamList>();
  const [navigationContainerReady, setNavigationContainerReady] = React.useState(false);
  const [navigationStateReady, setNavigationStateReady] = React.useState(false);

  useSupabaseDeepLinkBridge(navigationRef);
  usePushNotificationResponseBridge({
    navigationReady: navigationContainerReady,
    navigationRef,
  });

  const showAuthenticatedShell = isLoggedIn || isAuthenticatedBootState(authBootState);

  const controller = useRootNavigationController({
    accountType,
    isLoading,
    isLoggedIn: showAuthenticatedShell,
    navigationRef,
    setBottomTabsVisible,
    triggerTabReselect,
  });

  const { prefetchTabIntent } = useTabLandingPrefetch({
    activeRoute: controller.currentRoute,
    enabled: controller.showAppTabs && authBootState === "signed_in_hydrated",
    userId: userData.id,
    username: userData.username,
  });

  const canRenderNavigation = !isAuthBootstrapPending && navigationStateReady;
  const showSplashOverlay = !canRenderNavigation || !queryCacheReady || !navigationContainerReady;

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      controller.handleHardwareBack,
    );
    return () => subscription.remove();
  }, [controller.handleHardwareBack]);

  React.useEffect(() => {
    setNavigationStateReady(true);
  }, []);

  React.useEffect(() => {
    if (!canRenderNavigation) {
      setNavigationContainerReady(false);
    }
  }, [canRenderNavigation]);

  React.useEffect(() => {
    if (showSplashOverlay) return;
    let cancelled = false;
    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        void hideNativeSplashScreen();
      });
      if (cancelled) {
        cancelAnimationFrame(secondFrame);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
    };
  }, [showSplashOverlay]);

  const handleNavigationReady = React.useCallback(() => {
    if (navigationRef.isReady()) {
      registerNavigationContainer(navigationRef);
    }
    controller.handleReady();
    requestAnimationFrame(() => {
      setNavigationContainerReady(true);
    });
  }, [controller, navigationRef]);

  const handleNavigationStateChange = React.useCallback(() => {
    controller.handleStateChange();
  }, [controller]);

  const showOnboardingCoordinator = authBootState === "signed_in_hydrated" && queryCacheReady;

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      {canRenderNavigation ? (
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          linking={rootNavigationLinking}
          onReady={handleNavigationReady}
          onStateChange={handleNavigationStateChange}
        >
          <View style={{ flex: 1 }}>
            <AppUploadActivityBar navigationRef={navigationRef} />
            <AppNetworkStatusBanner />
            <RootNavigatorScreens showAuthenticatedShell={showAuthenticatedShell} />
          </View>

          {controller.showAppTabs ? (
            <MainBottomTabs
              active={controller.currentTab}
              visible={bottomTabsVisible}
              accountType={controller.accountType}
              onHome={controller.handleHomePress}
              onSearch={controller.handleSearchPress}
              onProfile={controller.handleProfilePress}
              onCreate={controller.handleCreatePress}
              onIntent={prefetchTabIntent}
            />
          ) : null}

          <FeedToast message={controller.exitMessage} />

          {showOnboardingCoordinator ? <OnboardingCoordinator /> : null}
        </NavigationContainer>
      ) : null}

      {showSplashOverlay ? <StartupSplashScreen /> : null}
    </View>
  );
}
