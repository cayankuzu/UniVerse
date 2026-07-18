import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { APP_ENV } from "../../platform/config/runtime";
import { useAuth } from "../auth";
import { debugLog, debugWarn } from "../../platform/logging/logger";
import { isHttpRequestError } from "../../platform/api/core";
import { supabase } from "../../platform/supabase";
import { NotificationPushAPI } from "../../features/notifications/public/push";
import { getStableQueueJitterMs } from "../queues/queueResumeScheduler";
import {
  ACTIVE_PUSH_SYNC_DELAY_MS,
  ensureAndroidNotificationChannel,
  hasNotificationPermission,
  INITIAL_BACKOFF_MS,
  INITIAL_PUSH_SYNC_DELAY_MS,
  MAX_PUSH_SYNC_RETRIES,
  MIN_PUSH_SYNC_INTERVAL_MS,
  PUSH_AUTH_REJECT_COOLDOWN_MS,
  PUSH_SYNC_FRESH_MS,
  PUSH_SYNC_JITTER_WINDOW_MS,
  resolveExpoProjectId,
  resolvePushPlatform,
  shouldSkipPushRegistration,
} from "./pushRegistration.shared";

export function usePushRegistrationSync() {
  const { isLoggedIn, userData } = useAuth();
  const lastSyncedRegistrationKeyRef = useRef("");
  const lastSuccessfulSyncAtRef = useRef(0);
  const lastSyncAttemptAtRef = useRef(0);
  const lastAuthRejectAtRef = useRef(0);
  const permissionPromptAttemptedRef = useRef(false);
  const userId = String(userData.id || "").trim();

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      lastSyncedRegistrationKeyRef.current = "";
      lastSuccessfulSyncAtRef.current = 0;
      lastSyncAttemptAtRef.current = 0;
      lastAuthRejectAtRef.current = 0;
      permissionPromptAttemptedRef.current = false;
    }
  }, [isLoggedIn, userId]);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    if (shouldSkipPushRegistration(APP_ENV)) {
      permissionPromptAttemptedRef.current = false;
      void NotificationPushAPI.getStoredRegistration().then((stored) => {
        if (!stored?.expoPushToken) return;
        void NotificationPushAPI.unregisterToken(stored.expoPushToken).catch(() => undefined);
        void NotificationPushAPI.clearStoredRegistration().catch(() => undefined);
      });
      debugLog("PUSH", "push-registration-skipped", {
        appEnv: APP_ENV,
        reason: "local-runtime-disabled",
        userId,
      });
      return;
    }
    const platform = resolvePushPlatform();
    if (!platform) return;

    let disposed = false;
    let retryCount = 0;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    let scheduledSyncAt: number | null = null;

    const hasFreshRegistration = () =>
      Boolean(lastSyncedRegistrationKeyRef.current) &&
      Date.now() - lastSuccessfulSyncAtRef.current < PUSH_SYNC_FRESH_MS;

    const syncPushRegistration = async () => {
      const stored = await NotificationPushAPI.getStoredRegistration();
      let permissions = await Notifications.getPermissionsAsync();
      const rawPermissionStatus = String((permissions as { status?: unknown }).status || "")
        .trim()
        .toLowerCase();
      if (
        !hasNotificationPermission(permissions) &&
        rawPermissionStatus === "undetermined" &&
        !permissionPromptAttemptedRef.current
      ) {
        permissionPromptAttemptedRef.current = true;
        permissions = await Notifications.requestPermissionsAsync();
      }
      if (!hasNotificationPermission(permissions)) {
        if (stored?.userId === userId) {
          await NotificationPushAPI.unregisterToken(stored.expoPushToken).catch(() => undefined);
          await NotificationPushAPI.clearStoredRegistration();
          lastSyncedRegistrationKeyRef.current = "";
        }
        return false;
      }
      permissionPromptAttemptedRef.current = true;

      const projectId = resolveExpoProjectId();
      if (!projectId) {
        debugWarn("PUSH", "missing-eas-project-id", {
          appEnv: APP_ENV,
        });
        return false;
      }

      await ensureAndroidNotificationChannel();
      const expoPushToken = String(
        (await Notifications.getExpoPushTokenAsync({ projectId })).data || "",
      ).trim();
      if (!expoPushToken) {
        debugWarn("PUSH", "expo-push-token-empty");
        return false;
      }

      const registrationKey = `${userId}:${APP_ENV}:${platform}:${expoPushToken}`;
      if (lastSyncedRegistrationKeyRef.current === registrationKey) {
        return true;
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const tokenExpiresAt = currentSession?.expires_at ?? 0;
      const isTokenExpiredOrMissing =
        !currentSession?.access_token || tokenExpiresAt * 1000 <= Date.now() + 30_000;
      if (isTokenExpiredOrMissing) {
        debugLog("PUSH", "push-pre-refresh", { userId, tokenExpiresAt });
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          debugWarn("PUSH", "push-session-refresh-failed", {
            message: refreshError.message,
            userId,
          });
          return false;
        }
      }

      const {
        data: { user: authUser },
        error: authUserError,
      } = await supabase.auth.getUser();
      if (authUserError || !authUser?.id || authUser.id !== userId) {
        debugWarn("PUSH", "push-auth-user-unverified", {
          authUserId: authUser?.id || null,
          message: authUserError?.message || null,
          userId,
        });
        return false;
      }

      await NotificationPushAPI.registerToken({
        appEnv: APP_ENV,
        expoPushToken,
        platform,
      });
      await NotificationPushAPI.rememberRegistration({
        appEnv: APP_ENV,
        expoPushToken,
        platform,
        userId,
      });
      lastSyncedRegistrationKeyRef.current = registrationKey;
      lastSuccessfulSyncAtRef.current = Date.now();
      debugLog("PUSH", "push-registration-synced", {
        appEnv: APP_ENV,
        platform,
        userId,
      });
      return true;
    };

    type SyncResult = boolean | "auth-error";

    const runSync = async (): Promise<SyncResult> => {
      const now = Date.now();
      if (hasFreshRegistration()) {
        return true;
      }
      if (now - lastAuthRejectAtRef.current < PUSH_AUTH_REJECT_COOLDOWN_MS) {
        return "auth-error";
      }
      if (now - lastSyncAttemptAtRef.current < MIN_PUSH_SYNC_INTERVAL_MS) {
        return true;
      }
      lastSyncAttemptAtRef.current = now;
      try {
        return await syncPushRegistration();
      } catch (error) {
        if (disposed) return false;
        if (isHttpRequestError(error) && (error.httpStatus === 401 || error.httpStatus === 403)) {
          lastAuthRejectAtRef.current = Date.now();
          debugWarn("PUSH", "push-registration-auth-rejected", {
            httpStatus: error.httpStatus,
            userId,
          });
          return "auth-error";
        }
        debugWarn("PUSH", "push-registration-sync-failed", {
          message: String((error as { message?: string })?.message || error || ""),
          userId,
        });
        return false;
      }
    };

    const scheduleRetry = () => {
      if (disposed || retryCount >= MAX_PUSH_SYNC_RETRIES) {
        if (retryCount >= MAX_PUSH_SYNC_RETRIES) {
          debugWarn("PUSH", "push-registration-max-retries", { retryCount, userId });
        }
        return;
      }
      const backoffMs =
        INITIAL_BACKOFF_MS * Math.pow(2, Math.min(retryCount, 4)) +
        getStableQueueJitterMs(`${userId}:push-retry:${retryCount}`, PUSH_SYNC_JITTER_WINDOW_MS);
      retryCount += 1;
      scheduledSyncAt = Date.now() + backoffMs;
      pendingTimeout = setTimeout(() => {
        scheduledSyncAt = null;
        void runSync().then((result) => {
          if (result === true || result === "auth-error") return;
          scheduleRetry();
        });
      }, backoffMs);
    };

    const scheduleSync = (baseDelayMs: number) => {
      if (disposed || hasFreshRegistration()) {
        return;
      }
      const delayMs =
        baseDelayMs + getStableQueueJitterMs(`${userId}:push-sync`, PUSH_SYNC_JITTER_WINDOW_MS);
      const targetAt = Date.now() + delayMs;
      if (pendingTimeout && scheduledSyncAt !== null && scheduledSyncAt <= targetAt) {
        return;
      }
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      scheduledSyncAt = targetAt;
      pendingTimeout = setTimeout(
        () => {
          pendingTimeout = null;
          scheduledSyncAt = null;
          void runSync().then((result) => {
            if (result === true || result === "auth-error") return;
            scheduleRetry();
          });
        },
        Math.max(0, targetAt - Date.now()),
      );
    };

    scheduleSync(INITIAL_PUSH_SYNC_DELAY_MS);

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !disposed) {
        if (hasFreshRegistration()) {
          return;
        }
        retryCount = 0;
        scheduleSync(ACTIVE_PUSH_SYNC_DELAY_MS);
      }
    });

    return () => {
      disposed = true;
      if (pendingTimeout) clearTimeout(pendingTimeout);
      appStateSubscription.remove();
    };
  }, [isLoggedIn, userId]);
}
