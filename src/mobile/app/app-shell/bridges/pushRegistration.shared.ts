import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  DEFAULT_NOTIFICATION_CHANNEL_ID,
  resolveForegroundNotificationBehavior,
} from "./foregroundPushMirror";
import {
  resolveExpoProjectId,
  resolvePushPlatform,
  resolvePushRuntimeSupport,
} from "../../platform/notifications/pushRuntime";

export const INITIAL_PUSH_SYNC_DELAY_MS = 120;
export const ACTIVE_PUSH_SYNC_DELAY_MS = 220;
export const INITIAL_BACKOFF_MS = 1_500;
export const MAX_PUSH_SYNC_RETRIES = 5;
export const MIN_PUSH_SYNC_INTERVAL_MS = 30_000;
export const PUSH_SYNC_FRESH_MS = 15 * 60_000;
export const PUSH_AUTH_REJECT_COOLDOWN_MS = 10 * 60_000;
export const PUSH_SYNC_JITTER_WINDOW_MS = 180;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => resolveForegroundNotificationBehavior(notification),
});

export { DEFAULT_NOTIFICATION_CHANNEL_ID, resolveExpoProjectId, resolvePushPlatform };

export function shouldSkipPushRegistration(appEnv: string) {
  if (appEnv !== "development" && appEnv !== "preview" && appEnv !== "production") {
    return true;
  }
  return !resolvePushRuntimeSupport().enabled;
}

export function hasNotificationPermission(status: Notifications.NotificationPermissionsStatus) {
  const permissionStatus = String((status as { status?: unknown }).status || "")
    .trim()
    .toLowerCase();
  const granted = Boolean((status as { granted?: unknown }).granted);
  return (
    granted ||
    permissionStatus === "granted" ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.MAX,
    lightColor: "#2563eb",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    name: "Genel",
    vibrationPattern: [0, 250, 250, 250],
  });
}
