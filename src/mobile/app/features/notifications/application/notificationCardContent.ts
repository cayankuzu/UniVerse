import type { NotificationItem } from "../../../data/contracts/api";

export type NotificationCardContent = {
  actionText: string;
  actorName: string;
  contextLabel?: string;
  contextSubtitle?: string;
  contextTitle?: string;
  previewText?: string;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isReplyMessage(message: string) {
  const normalized = message.toLocaleLowerCase("tr");
  return normalized.includes("yanit") || normalized.includes("yanıt");
}

function isEventPublishMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("yeni etkinlik") ||
    normalized.includes("etkinlik paylas") ||
    normalized.includes("etkinlik paylaş")
  );
}

function isEventAttendanceMessage(message: string) {
  const normalized = message.toLocaleLowerCase("tr");
  return normalized.includes("katildi") || normalized.includes("katıldı");
}

function buildActionText(item: NotificationItem, message: string) {
  switch (item.type) {
    case "comment":
      if (isReplyMessage(message)) {
        return item.targetType === "album"
          ? "albüm yorumunuza yanıt verdi"
          : "yorumunuza yanıt verdi";
      }
      if (item.targetType === "album") return "albümünüze yorum yaptı";
      if (item.targetType === "event") return "etkinliğinize yorum yaptı";
      return message || "yorum yaptı";
    case "like":
      if (item.targetType === "album") return "albümünüzü beğendi";
      if (item.targetType === "event") return "etkinliğinizi beğendi";
      return message || "beğeni bıraktı";
    case "event":
      if (item.targetType === "album" || item.photoId) {
        return "etkinliğinize albüm ekledi";
      }
      if (isEventPublishMessage(message)) {
        return "yeni bir etkinlik paylaştı";
      }
      if (isEventAttendanceMessage(message)) {
        return "etkinliğinize katıldı";
      }
      return message || "etkinlik bildirimi gönderdi";
    case "join":
      return "etkinliğe katıldı";
    case "join_request":
      return "etkinliğe katılmak istiyor";
    case "join_accepted":
      return "katılım isteğinizi kabul etti";
    case "join_rejected":
      return "katılım isteğinizi reddetti";
    case "follow":
    case "follow_accepted":
    case "follow_request":
    case "system":
      return message || "yeni bir bildirim gönderdi";
    default:
      return message || "yeni bir bildirim gönderdi";
  }
}

function buildContext(item: NotificationItem, detail: string) {
  const directTitle = normalizeText(item.contentTitle);
  const eventTitle = normalizeText(item.eventTitle);
  const directSubtitle = normalizeText(item.contentSubtitle);

  if (item.targetType === "album") {
    const contextTitle = directTitle || "";
    if (contextTitle) {
      return {
        contextLabel: "Albüm",
        contextSubtitle:
          directSubtitle || (eventTitle && eventTitle !== contextTitle ? eventTitle : undefined),
        contextTitle,
      };
    }
    if (eventTitle) {
      return {
        contextLabel: "Etkinlik",
        contextTitle: eventTitle,
      };
    }
    if (item.type !== "comment" && detail) {
      return {
        contextLabel: "Albüm",
        contextTitle: detail,
      };
    }
    return {};
  }

  if (item.targetType === "event") {
    const contextTitle = directTitle || eventTitle || (item.type !== "comment" ? detail : "");
    if (!contextTitle) return {};
    return {
      contextLabel: "Etkinlik",
      contextTitle,
    };
  }

  return {};
}

function buildPreview(item: NotificationItem, detail: string, contextTitle?: string) {
  if (!detail) return undefined;
  if (item.type !== "comment") return undefined;
  if (detail === contextTitle) return undefined;
  return detail;
}

export function buildNotificationCardContent(item: NotificationItem): NotificationCardContent {
  const actorName = normalizeText(item.fromName || item.fromUsername || "Bir kullanıcı");
  const message = normalizeText(item.message);
  const detail = normalizeText(item.detail);
  const context = buildContext(item, detail);

  return {
    actionText: buildActionText(item, message),
    actorName,
    contextLabel: context.contextLabel,
    contextSubtitle: context.contextSubtitle,
    contextTitle: context.contextTitle,
    previewText: buildPreview(item, detail, context.contextTitle),
  };
}
