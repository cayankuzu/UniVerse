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
});
