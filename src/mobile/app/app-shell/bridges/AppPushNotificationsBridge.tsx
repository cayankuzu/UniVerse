import { usePushRegistrationSync } from "./usePushRegistrationSync";
import { usePushNotificationPresenceSync } from "./usePushNotificationPresenceSync";

export function AppPushNotificationsBridge() {
  usePushRegistrationSync();
  usePushNotificationPresenceSync();
  return null;
}
