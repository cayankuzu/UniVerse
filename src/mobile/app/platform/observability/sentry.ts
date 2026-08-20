import type React from "react";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";
import { appReleaseMeta, crashReporterConfig } from "./config";
import { redactValue } from "../security/redaction";

let navigationIntegration: ReturnType<typeof Sentry.reactNavigationIntegration> | null = null;

function getNavigationIntegration() {
  if (!navigationIntegration) {
    navigationIntegration = Sentry.reactNavigationIntegration({
      enablePrefetchTracking: true,
      enableTimeToInitialDisplay: true,
      useDispatchedActionData: true,
    });
  }
  return navigationIntegration;
}

function sanitizeSentryPayload<T>(value: T): T {
  return redactValue(value);
}

let initialized = false;

export function initializeCrashReporter() {
  if (initialized) return;
  initialized = true;

  const replayEnabled =
    crashReporterConfig.enabled &&
    appReleaseMeta.appEnv !== "development" &&
    (crashReporterConfig.replaysOnErrorSampleRate > 0 ||
      crashReporterConfig.replaysSessionSampleRate > 0);
  const replayIntegration = replayEnabled
    ? Sentry.mobileReplayIntegration({
        enableViewRendererV2: true,
        maskAllImages: true,
        maskAllText: true,
        maskAllVectors: true,
        ...(Platform.OS === "android" ? { screenshotStrategy: "pixelCopy" as const } : {}),
      })
    : null;

  Sentry.init({
    attachStacktrace: true,
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === "console" && breadcrumb.level === "debug") {
        return null;
      }
      return sanitizeSentryPayload(breadcrumb);
    },
    beforeSend: (event) => {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.name;
        delete event.user.username;
      }
      return sanitizeSentryPayload(event);
    },
    dist: crashReporterConfig.dist,
    dsn: crashReporterConfig.dsn || undefined,
    enabled: crashReporterConfig.enabled,
    enableAutoSessionTracking: true,
    environment: crashReporterConfig.environment,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
      ...(crashReporterConfig.enabled ? [getNavigationIntegration()] : []),
      ...(replayIntegration ? [replayIntegration] : []),
    ],
    profilesSampleRate: crashReporterConfig.profilesSampleRate,
    replaysOnErrorSampleRate: replayEnabled ? crashReporterConfig.replaysOnErrorSampleRate : 0,
    replaysSessionQuality: crashReporterConfig.replaysSessionQuality,
    replaysSessionSampleRate: replayEnabled ? crashReporterConfig.replaysSessionSampleRate : 0,
    release: crashReporterConfig.release,
    sendDefaultPii: false,
    tracesSampleRate: crashReporterConfig.tracesSampleRate,
  });

  Sentry.setTags({
    app_env: appReleaseMeta.appEnv,
    platform: Platform.OS,
    release_channel: appReleaseMeta.releaseChannel,
    runtime_version: appReleaseMeta.runtimeVersion,
  });
}

export function wrapRootComponent<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
) {
  return Sentry.wrap<P>(Component);
}

export function registerNavigationContainer<T extends Record<string, object | undefined>>(
  navigationRef: NavigationContainerRefWithCurrent<T>,
) {
  if (!crashReporterConfig.enabled) return;
  getNavigationIntegration().registerNavigationContainer(navigationRef);
}

export function setCrashReporterUser(params: {
  accountType: "club" | "student";
  userId?: string | null;
  viewerKey?: string;
}) {
  if (!crashReporterConfig.enabled) return;
  Sentry.setTags({
    account_type: params.accountType,
    viewer_key: params.viewerKey || "guest",
  });
  Sentry.setUser(
    params.userId
      ? {
          id: params.userId,
          segment: params.accountType,
        }
      : null,
  );
}

export function clearCrashReporterUser() {
  if (!crashReporterConfig.enabled) return;
  Sentry.setUser(null);
  Sentry.setTag("viewer_key", "guest");
}

export function captureReleaseHealthCheck(label = "preview-healthcheck") {
  if (!crashReporterConfig.enabled) return;
  Sentry.captureMessage(`release-health:${appReleaseMeta.releaseChannel}:${label}`);
}

export { Sentry };
