import type { NotificationItem } from "../../../data/contracts/api";
import { buildNotificationCardContent } from "./notificationCardContent";

function createNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    createdAt: "2026-07-02T00:00:00.000Z",
    fromImage: "",
    fromName: "Test User",
    fromUserId: "actor-id",
    fromUsername: "test-user",
    id: "notification-id",
    message: "bildirim",
    read: false,
    targetType: "profile",
    time: "simdi",
    type: "system",
    ...overrides,
  };
}

describe("buildNotificationCardContent", () => {
  it("surfaces album title, parent event, and comment preview for album comments", () => {
    const result = buildNotificationCardContent(
      createNotification({
        contentSubtitle: "Tasarim Gecesi",
        contentTitle: "Bahar Sergisi Albumu",
        detail: "Harika gorunuyor",
        message: "albumuna yorum yapti",
        photoId: "photo-1",
        targetType: "album",
        type: "comment",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        actionText: "albümünüze yorum yaptı",
        contextLabel: "Albüm",
        contextSubtitle: "Tasarim Gecesi",
        contextTitle: "Bahar Sergisi Albumu",
        previewText: "Harika gorunuyor",
      }),
    );
  });

  it("formats reply notifications with the event title as context", () => {
    const result = buildNotificationCardContent(
      createNotification({
        contentTitle: "Hackathon Tanitim Toplantisi",
        detail: "Aksam 8'de basliyor",
        eventTitle: "Hackathon Tanitim Toplantisi",
        message: "yorumuna yanit verdi",
        targetType: "event",
        type: "comment",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        actionText: "yorumunuza yanıt verdi",
        contextLabel: "Etkinlik",
        contextTitle: "Hackathon Tanitim Toplantisi",
        previewText: "Aksam 8'de basliyor",
      }),
    );
  });

  it("falls back to the existing detail title for album likes until projection metadata arrives", () => {
    const result = buildNotificationCardContent(
      createNotification({
        detail: "Kulup Anilari",
        message: "albumunu begendi",
        photoId: "photo-1",
        targetType: "album",
        type: "like",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        actionText: "albümünüzü beğendi",
        contextLabel: "Albüm",
        contextTitle: "Kulup Anilari",
        previewText: undefined,
      }),
    );
  });

  it("renders club event share notifications without reusing attendance copy", () => {
    const result = buildNotificationCardContent(
      createNotification({
        contentTitle: "Yaz Kampusu Bulusmasi",
        detail: "Yaz Kampusu Bulusmasi",
        eventTitle: "Yaz Kampusu Bulusmasi",
        message: "yeni etkinlik paylasti",
        targetType: "event",
        type: "event",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        actionText: "yeni bir etkinlik paylaştı",
        contextLabel: "Etkinlik",
        contextTitle: "Yaz Kampusu Bulusmasi",
      }),
    );
  });

  it.each([
    ["comment", "event", "", {}],
    ["comment", "profile", "", {}],
    ["like", "event", "", {}],
    ["like", "profile", "", {}],
    ["event", "album", "", {}],
    ["event", "event", "etkinlige katildi", {}],
    ["event", "profile", "", {}],
    ["join", "event", "", {}],
    ["join_request", "event", "", {}],
    ["join_accepted", "event", "", {}],
    ["join_rejected", "event", "", {}],
    ["follow", "profile", "", {}],
    ["unknown", "profile", "", {}],
  ] as const)(
    "provides deterministic fallback copy for %s notifications targeting %s",
    (type, targetType, message, extra) => {
      const result = buildNotificationCardContent(
        createNotification({
          ...extra,
          message,
          targetType,
          type: type as NotificationItem["type"],
        }),
      );

      expect(result.actionText).toEqual(expect.any(String));
      expect(result.actionText.length).toBeGreaterThan(0);
    },
  );

  it("uses the album-specific reply copy and event fallback context", () => {
    const result = buildNotificationCardContent(
      createNotification({
        contentTitle: "",
        detail: "yorum",
        eventTitle: "Etkinlik",
        message: "yanit verdi",
        targetType: "album",
        type: "comment",
      }),
    );

    expect(result.actionText).toContain("yorumunuza");
    expect(result.contextTitle).toBe("Etkinlik");
  });
});
