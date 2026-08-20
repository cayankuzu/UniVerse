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

  it("rejects malformed payload values without manufacturing a navigation target", () => {
    const response = {
      actionIdentifier: "default",
      notification: {
        request: {
          content: {
            data: {
              eventId: { unexpected: true },
              fromUsername: ["cayan"],
              notificationId: 42,
              photoId: false,
              targetType: "unsupported",
            },
          },
          identifier: "request-malformed",
        },
      },
    };

    const payload = parsePushNotificationPayload(response);
    expect(payload).toEqual({
      eventId: undefined,
      fromUsername: undefined,
      notificationId: undefined,
      photoId: undefined,
      targetType: undefined,
    });
    expect(buildPushNotificationNavigationTarget(payload)).toBeNull();
    expect(buildPushNotificationResponseHandlingKey(response)).toBe("request-malformed:default");
  });

  it("builds the same handling key for duplicate delivery responses", () => {
    const firstResponse = {
      actionIdentifier: "default",
      notification: {
        request: {
          content: { data: { eventId: "event-1", notificationId: "notification-1" } },
          identifier: "request-1",
        },
      },
    };
    const duplicateResponse = JSON.parse(JSON.stringify(firstResponse));

    expect(buildPushNotificationResponseHandlingKey(duplicateResponse)).toBe(
      buildPushNotificationResponseHandlingKey(firstResponse),
    );
  });
});
