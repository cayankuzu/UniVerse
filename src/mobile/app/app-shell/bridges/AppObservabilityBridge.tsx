import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { useAppStartupState } from "../startup/AppStartupState";
import { getViewerKey } from "../../data/contracts/viewerKey";
import {
  appReleaseMeta,
  captureReleaseHealthCheck,
  clearCrashReporterUser,
  Sentry,
  setCrashReporterUser,
} from "../../platform/observability";

export function AppObservabilityBridge() {
  const { accountType, isDemoMode, isLoading, isLoggedIn, userData } = useAuth();
  const { queryCacheReady } = useAppStartupState();
  const hasCapturedReleaseHealthRef = useRef(false);
  const viewerKey = getViewerKey(userData);

  useEffect(() => {
    if (hasCapturedReleaseHealthRef.current) return;
    if (appReleaseMeta.appEnv === "production") return;
    if (isLoading || !queryCacheReady) return;
    hasCapturedReleaseHealthRef.current = true;
    captureReleaseHealthCheck("app-launch");
  }, [isLoading, queryCacheReady]);

  useEffect(() => {
    if (!isLoggedIn || isDemoMode) {
      clearCrashReporterUser();
      Sentry.setContext("session", null);
      return;
    }

    setCrashReporterUser({
      accountType,
      userId: userData.id || null,
      viewerKey,
    });
    Sentry.setContext("session", {
      accountType,
      hasProfileImage: Boolean(userData.profileImage),
      isPrivate: Boolean(userData.isPrivate),
      university: userData.university ? "set" : "missing",
    });

    return () => {
      Sentry.setContext("session", null);
    };
  }, [
    accountType,
    isDemoMode,
    isLoggedIn,
    userData.id,
    userData.isPrivate,
    userData.profileImage,
    userData.university,
    viewerKey,
  ]);

  return null;
}
