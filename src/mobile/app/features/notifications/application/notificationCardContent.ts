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
  return message.toLowerCase().includes("yanit");
}

function isEventPublishMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("yeni etkinlik") || normalized.includes("etkinlik paylas");
}

function isEventAttendanceMessage(message: string) {
  return message.toLowerCase().includes("katildi");
}

function buildActionText(item: NotificationItem, message: string) {
  switch (item.type) {
    case "comment":
      if (isReplyMessage(message)) {
        return item.targetType === "album"
          ? "album yorumunuza yanit verdi"
          : "yorumunuza yanit verdi";
      }
      if (item.targetType === "album") return "albumunuza yorum yapti";
      if (item.targetType === "event") return "etkinliginize yorum yapti";
      return message || "yorum yapti";
    case "like":
      if (item.targetType === "album") return "albumunuzu begendi";
      if (item.targetType === "event") return "etkinliginizi begendi";
      return message || "begeni birakti";
    case "event":
      if (item.targetType === "album" || item.photoId) {
        return "etkinliginize album ekledi";
      }
      if (isEventPublishMessage(message)) {
        return "yeni bir etkinlik paylasti";
      }
      if (isEventAttendanceMessage(message)) {
        return "etkinliginize katildi";
      }
      return message || "etkinlik bildirimi gonderdi";
    case "join":
      return "etkinlige katildi";
    case "join_request":
      return "etkinlige katilmak istiyor";
    case "join_accepted":
      return "katilim isteginizi kabul etti";
    case "join_rejected":
      return "katilim isteginizi reddetti";
    case "follow":
    case "follow_accepted":
    case "follow_request":
    case "system":
      return message || "yeni bir bildirim gonderdi";
    default:
      return message || "yeni bir bildirim gonderdi";
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
        contextLabel: "Album",
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
        contextLabel: "Album",
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
  const actorName = normalizeText(item.fromName || item.fromUsername || "Bir kullanici");
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
