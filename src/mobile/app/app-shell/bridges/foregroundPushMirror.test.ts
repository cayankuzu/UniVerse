import * as Notifications from "expo-notifications";
import {
  buildForegroundPushMirrorContent,
  maybePresentForegroundPushNotification,
  resolveForegroundNotificationBehavior,
  shouldMirrorForegroundPushNotification,
} from "./foregroundPushMirror";

function createNotification(overrides?: Partial<Notifications.Notification>) {
  return {
    date: Date.parse("2026-08-19T12:00:00.000Z"),
    request: {
      content: {
        body: "Aciklama",
        categoryIdentifier: null,
        data: {},
        sound: "default",
        subtitle: null,
        title: "Baslik",
      },
      identifier: "remote-notification-1",
      trigger: null,
    },
    ...overrides,
  } as Notifications.Notification;
}

describe("foregroundPushMirror", () => {
  it("suppresses the original remote foreground notification on android", () => {
    const behavior = resolveForegroundNotificationBehavior(createNotification(), "android");

    expect(behavior).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });

  it("shows the mirrored local foreground notification on android", () => {
    const behavior = resolveForegroundNotificationBehavior(
      createNotification({
        request: {
          content: {
            body: "Aciklama",
            categoryIdentifier: null,
            data: { __foregroundPushMirror: "1" },
            sound: "default",
            subtitle: null,
            title: "Baslik",
          },
          identifier: "local-notification-1",
          trigger: null,
        },
      }),
      "android",
    );

    expect(behavior).toEqual({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it("builds mirrored content with the internal mirror flag", () => {
    const content = buildForegroundPushMirrorContent(createNotification());

    expect(content).toMatchObject({
      body: "Aciklama",
      sound: "default",
      title: "Baslik",
    });
    expect(content.data).toMatchObject({
      __foregroundPushMirror: "1",
    });
  });

  it("schedules a mirrored local notification only while android is active", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    scheduleNotificationAsync.mockClear();

    const shouldMirror = shouldMirrorForegroundPushNotification({
      appState: "active",
      notification: createNotification(),
      platform: "android",
    });
    expect(shouldMirror).toBe(true);

    await maybePresentForegroundPushNotification({
      appState: "active",
      notification: createNotification(),
      platform: "android",
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        body: "Aciklama",
        title: "Baslik",
      }),
      trigger: { channelId: "default" },
    });
  });

  it("does not mirror notifications that are already mirrored", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    scheduleNotificationAsync.mockClear();

    const mirroredNotification = createNotification({
      request: {
        content: {
          body: "Aciklama",
          categoryIdentifier: null,
          data: { __foregroundPushMirror: "1" },
          sound: "default",
          subtitle: null,
          title: "Baslik",
        },
        identifier: "local-notification-1",
        trigger: null,
      },
    });

    await maybePresentForegroundPushNotification({
      appState: "active",
      notification: mirroredNotification,
      platform: "android",
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
