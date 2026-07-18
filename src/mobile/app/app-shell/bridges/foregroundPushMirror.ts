import * as Notifications from "expo-notifications";
import { resolvePushPlatform } from "../../platform/notifications/pushRuntime";

export const DEFAULT_NOTIFICATION_CHANNEL_ID = "default";
const FOREGROUND_PUSH_MIRROR_FLAG = "__foregroundPushMirror";

type PushPlatform = ReturnType<typeof resolvePushPlatform>;

function normalizeData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export function isForegroundPushMirrorNotification(
  notification: Pick<Notifications.Notification, "request"> | null | undefined,
) {
  const data = normalizeData(notification?.request.content.data);
  return normalizeText(data[FOREGROUND_PUSH_MIRROR_FLAG]) === "1";
}

export function resolveForegroundNotificationBehavior(
  notification: Notifications.Notification,
  platform: PushPlatform = resolvePushPlatform(),
) {
  if (platform !== "android") {
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  }

  if (isForegroundPushMirrorNotification(notification)) {
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  }

  return {
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: false,
  };
}

export function shouldMirrorForegroundPushNotification(params: {
  appState: string;
  notification: Notifications.Notification;
  platform?: PushPlatform;
}) {
  const { appState, notification, platform = resolvePushPlatform() } = params;
  if (platform !== "android") return false;
  if (normalizeText(appState).toLowerCase() !== "active") return false;
  if (isForegroundPushMirrorNotification(notification)) return false;

  const title = normalizeText(notification.request.content.title);
  const body = normalizeText(notification.request.content.body);
  return Boolean(title || body);
}

export function buildForegroundPushMirrorContent(notification: Notifications.Notification) {
  const data = normalizeData(notification.request.content.data);
  const title = normalizeText(notification.request.content.title);
  const body = normalizeText(notification.request.content.body);
  const subtitle = normalizeText(notification.request.content.subtitle);

  return {
    body: body || null,
    data: {
      ...data,
      [FOREGROUND_PUSH_MIRROR_FLAG]: "1",
    },
    sound: "default" as const,
    subtitle: subtitle || null,
    title: title || null,
  } satisfies Notifications.NotificationContentInput;
}

export async function maybePresentForegroundPushNotification(params: {
  appState: string;
  notification: Notifications.Notification;
  platform?: PushPlatform;
}) {
  const { notification, platform = resolvePushPlatform() } = params;
  if (!shouldMirrorForegroundPushNotification({ ...params, platform })) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: buildForegroundPushMirrorContent(notification),
    trigger: platform === "android" ? { channelId: DEFAULT_NOTIFICATION_CHANNEL_ID } : null,
  });
  return true;
}
