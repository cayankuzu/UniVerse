import {
  buildPushNotificationNavigationTarget,
  buildPushNotificationResponseHandlingKey,
  canNavigatePushNotificationTarget,
  parsePushNotificationPayload,
} from "./pushNotificationResponse.shared";

describe("pushNotificationResponse.shared", () => {
  it("parses album notification payloads", () => {
    const response = {
      actionIdentifier: "default",
      notification: {
        request: {
          content: {
            data: {
              eventId: "event-1",
              notificationId: "notification-1",
              photoId: "photo-1",
              targetType: "album",
            },
          },
          identifier: "request-1",
        },
      },
    };

    expect(parsePushNotificationPayload(response)).toEqual({
      eventId: "event-1",
      fromUsername: undefined,
      notificationId: "notification-1",
      photoId: "photo-1",
      targetType: "album",
    });
    expect(buildPushNotificationNavigationTarget(parsePushNotificationPayload(response))).toEqual({
      eventId: "event-1",
      fromUsername: undefined,
      id: "notification-1",
      photoId: "photo-1",
      targetType: "album",
    });
    expect(
      canNavigatePushNotificationTarget(
        buildPushNotificationNavigationTarget(parsePushNotificationPayload(response)),
      ),
    ).toBe(true);
    expect(buildPushNotificationResponseHandlingKey(response)).toBe(
      "request-1:default:notification-1:album:event-1:photo-1",
    );
  });

  it("derives profile targets from actor username payloads", () => {
    const target = buildPushNotificationNavigationTarget({
      fromUsername: "cayan",
      notificationId: "notification-2",
    });

    expect(target).toEqual({
      eventId: undefined,
      fromUsername: "cayan",
      id: "notification-2",
      photoId: undefined,
      targetType: "profile",
    });
    expect(canNavigatePushNotificationTarget(target)).toBe(true);
  });

  it("rejects incomplete targets", () => {
    expect(
      canNavigatePushNotificationTarget({
        eventId: undefined,
        fromUsername: undefined,
        photoId: undefined,
        targetType: "event",
      }),
    ).toBe(false);
  });
});
