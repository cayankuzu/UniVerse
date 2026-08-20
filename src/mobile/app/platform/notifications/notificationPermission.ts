import * as Notifications from "expo-notifications";
import { ensureAndroidNotificationChannel } from "./notificationChannel";

const grantedListeners = new Set<() => void>();

export function hasNotificationPermission(status: Notifications.NotificationPermissionsStatus) {
  const permissionStatus = String((status as { status?: unknown }).status || "")
    .trim()
    .toLowerCase();
  const granted = Boolean((status as { granted?: unknown }).granted);
  const iosStatus = status.ios?.status;
  const authorizedStatus = Notifications.IosAuthorizationStatus?.AUTHORIZED;
  const provisionalStatus = Notifications.IosAuthorizationStatus?.PROVISIONAL;
  const ephemeralStatus = Notifications.IosAuthorizationStatus?.EPHEMERAL;
  return (
    granted ||
    permissionStatus === "granted" ||
    (iosStatus !== null &&
      iosStatus !== undefined &&
      ((authorizedStatus !== undefined && iosStatus === authorizedStatus) ||
        (provisionalStatus !== undefined && iosStatus === provisionalStatus) ||
        (ephemeralStatus !== undefined && iosStatus === ephemeralStatus)))
  );
}

export async function requestNotificationPermissionFromUserInteraction() {
  await ensureAndroidNotificationChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (hasNotificationPermission(permissions)) {
    return true;
  }

  const status = String((permissions as { status?: unknown }).status || "")
    .trim()
    .toLowerCase();
  if (status !== "undetermined") {
    return false;
  }

  permissions = await Notifications.requestPermissionsAsync();
  const granted = hasNotificationPermission(permissions);
  if (granted) {
    grantedListeners.forEach((listener) => listener());
  }
  return granted;
}

export function subscribeNotificationPermissionGranted(listener: () => void) {
  grantedListeners.add(listener);
  return () => {
    grantedListeners.delete(listener);
  };
}
