import { getEventActionAccess } from "../../../data/policies/visibility";
import type { EventWithMeta } from "../data";

export function fallbackCommentCount(event: EventWithMeta) {
  const maybeComments = (event as EventWithMeta & { comments?: number }).comments;
  return typeof maybeComments === "number" ? maybeComments : 0;
}

export function showJoinDisabled(access: ReturnType<typeof getEventActionAccess>, joined: boolean) {
  if (access.isEnded) return true;
  return !joined && !access.canJoin;
}

function normalizeReasonCode(access: ReturnType<typeof getEventActionAccess>, error?: unknown) {
  if (access.joinReasonCode) return access.joinReasonCode;
  if (access.reasonCode) return access.reasonCode;

  const rawMessage = String((error as { message?: string })?.message || error || "")
    .trim()
    .toLowerCase();

  if (!rawMessage) return undefined;
  if (
    rawMessage.includes("club accounts cannot join events") ||
    rawMessage.includes("kulüp hesapları etkinliklere katılamaz")
  ) {
    return "CLUB_ACCOUNT_NOT_ALLOWED";
  }
  if (
    rawMessage.includes("event participation is locked") ||
    rawMessage.includes("event ended") ||
    rawMessage.includes("etkinlik sona erdi")
  ) {
    return "EVENT_ENDED";
  }
  if (
    rawMessage.includes("university required") ||
    rawMessage.includes("same university") ||
    rawMessage.includes("Üniversitesindeki") ||
    rawMessage.includes("Üniversitedeki") ||
    rawMessage.includes("Üniversite")
  ) {
    return "UNIVERSITY_REQUIRED";
  }
  if (rawMessage.includes("event attendance is not allowed") || rawMessage.includes("katılım")) {
    return "ATTENDANCE_NOT_ALLOWED";
  }
  if (rawMessage.includes("follow required") || rawMessage.includes("kulübü takip")) {
    return "FOLLOW_REQUIRED";
  }
  if (
    rawMessage.includes("unauthorized") ||
    rawMessage.includes("oturum") ||
    rawMessage.includes("giriş")
  ) {
    return "UNAUTHORIZED";
  }
  if (rawMessage.includes("blocked") || rawMessage.includes("erişemiyorsunuz")) {
    return "BLOCKED";
  }
  return undefined;
}

export function getJoinWarningMessage(
  access: ReturnType<typeof getEventActionAccess>,
  joined: boolean,
  error?: unknown,
) {
  const reasonCode = normalizeReasonCode(access, error);
  const rawMessage = String((error as { message?: string })?.message || error || "").trim();

  switch (reasonCode) {
    case "EVENT_ENDED":
      return joined
        ? "Etkinlik sona erdiği için katılımını geri alamazsın. Güncel katılım durumun korunuyor."
        : "Etkinlik sona erdiği için artık katılamazsın. Yalnızca albüm ve detayları inceleyebilirsin.";
    case "FOLLOW_REQUIRED":
      return joined
        ? "Katılım durumun değiştirilemiyor. Önce ilgili kulübü takip ederek erişimini koruduğundan emin ol."
        : "Bu etkinliğe katılmak için önce kulübü takip etmen gerekiyor.";
    case "UNIVERSITY_REQUIRED":
      return joined
        ? "Katılım durumun değiştirilemiyor. Bu etkinlik aynı üniversitedeki kullanıcılarla sınırlı."
        : "Bu etkinliğe sadece ilgili kulübün üniversitesindeki kullanıcılar katılabilir.";
    case "CLUB_ACCOUNT_NOT_ALLOWED":
      return "Kulüp hesapları etkinliklere katılamaz. Öğrenci hesabı ile deneyebilirsin.";
    case "UNAUTHORIZED":
      return joined
        ? "Katılım durumunu güncellemek için yeniden giriş yapman gerekiyor."
        : "Etkinliğe katılmak için yeniden giriş yapman gerekiyor.";
    case "BLOCKED":
      return joined
        ? "Bu etkinlik için katılım durumun değiştirilemiyor."
        : "Bu etkinlik için şu anda işlem yapamıyorsun.";
    case "ATTENDANCE_NOT_ALLOWED":
      return joined
        ? "Katılım durumun şu anda geri alınamıyor. Biraz sonra tekrar deneyebilirsin."
        : "Bu etkinliğe şu anda katılamıyorsun. Biraz sonra tekrar deneyebilirsin.";
    default:
      break;
  }

  if (access.joinReason) {
    return joined ? `${access.joinReason} Katılım durumun değişmedi.` : access.joinReason;
  }
  if (access.reason) {
    return joined ? `${access.reason} Katılım durumun değişmedi.` : access.reason;
  }
  if (rawMessage) {
    if (rawMessage.startsWith("HTTP ")) {
      return joined
        ? "Katılım durumun geri alınamadı. Sunucuya tekrar ulaşıp yeniden deneyebilirsin."
        : "Etkinliğe katılınamadı. Sunucuya tekrar ulaşıp yeniden deneyebilirsin.";
    }
    return joined ? `${rawMessage} Katılım durumun değişmedi.` : rawMessage;
  }

  return joined
    ? "Katılım durumun şu anda geri alınamıyor. Biraz sonra tekrar deneyebilirsin."
    : "Bu etkinliğe şu anda katılamıyorsun. Biraz sonra tekrar deneyebilirsin.";
}

export function getJoinButtonLabel(
  access: ReturnType<typeof getEventActionAccess>,
  joined: boolean,
) {
  if (joined || access.canJoin) return undefined;

  switch (normalizeReasonCode(access)) {
    case "EVENT_ENDED":
      return "Etkinlik Bitti";
    case "FOLLOW_REQUIRED":
      return "Takip Gerekli";
    case "UNIVERSITY_REQUIRED":
      return "Üni Gerekli";
    case "UNAUTHORIZED":
      return "Giriş Gerekli";
    case "BLOCKED":
      return "Erişim Yok";
    case "ATTENDANCE_NOT_ALLOWED":
      return "Katılım Kapalı";
    default:
      return "Katılım Kapalı";
  }
}
