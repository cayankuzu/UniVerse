import React from "react";
import "./app-shell/bridges/pushRegistration.shared";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./app-shell/auth";
import { AppObservabilityBridge } from "./app-shell/bridges/AppObservabilityBridge";
import { AppRuntimePerformanceBridge } from "./app-shell/bridges/AppRuntimePerformanceBridge";
import { AppSecurityBridge } from "./app-shell/bridges/AppSecurityBridge";
import { RootNavigator } from "./app-shell/navigation/RootNavigator";
import { ChromeVisibilityProvider } from "./app-shell/navigation/ChromeVisibilityContext";
import { TabReselectProvider } from "./app-shell/navigation/TabReselectContext";
import { OnboardingProvider } from "./app-shell/onboarding";
import { AppErrorBoundary } from "./app-shell/providers/AppErrorBoundary";
import { DeferredAppServices } from "./app-shell/startup/DeferredAppServices";
import { AppStartupStateProvider } from "./app-shell/startup/AppStartupState";
import { AppTransientActivityProvider } from "./shared/feedback/AppTransientActivityContext";
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE,
  queryCachePersister,
  shouldPersistQuery,
} from "./data/query/persist";
import { queryClient } from "./data/query/queryClient";
import { I18nBootstrap } from "./shared/i18n/I18nBootstrap";
import { appTheme } from "./shared/theme";
import { DeferredVideoCameraCaptureHost } from "./shared/components/DeferredVideoCameraCaptureHost";
import { AppFontGate } from "./shared/components/AppFontGate";

const PERSIST_QUERY_CLIENT_OPTIONS = {
  buster: QUERY_CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
  maxAge: QUERY_CACHE_MAX_AGE,
  persister: queryCachePersister,
} as const;

function handlePersistQueryRestoreSuccess() {
  void queryClient.resumePausedMutations();
}

export default function App() {
  return (
    <AppFontGate>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar backgroundColor={appTheme.colors.background} style="dark" />
          <PaperProvider theme={appTheme}>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={PERSIST_QUERY_CLIENT_OPTIONS}
              onSuccess={handlePersistQueryRestoreSuccess}
            >
              <AppStartupStateProvider>
                <AppTransientActivityProvider>
                  <ChromeVisibilityProvider>
                    <AuthProvider>
                      <I18nBootstrap />
                      <AppObservabilityBridge />
                      <AppRuntimePerformanceBridge />
                      <AppSecurityBridge />
                      <OnboardingProvider>
                        <TabReselectProvider>
                          <DeferredAppServices />
                          <DeferredVideoCameraCaptureHost />
                          <AppErrorBoundary>
                            <RootNavigator />
                          </AppErrorBoundary>
                        </TabReselectProvider>
                      </OnboardingProvider>
                    </AuthProvider>
                  </ChromeVisibilityProvider>
                </AppTransientActivityProvider>
              </AppStartupStateProvider>
            </PersistQueryClientProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppFontGate>
  );
}
