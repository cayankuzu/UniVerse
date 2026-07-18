import { EDGE_APP_ENV } from "../runtime.ts";

export type PushAppEnv = "development" | "preview" | "production";
export type PushPlatform = "android" | "ios";

export type NotificationDispatchRecord = {
  actor_id?: string | null;
  created_at?: string | null;
  detail?: string | null;
  event_id?: string | null;
  id: string;
  message?: string | null;
  photo_id?: string | null;
  target_profile_id?: string | null;
  type?: string | null;
  user_id?: string | null;
};

export type PushActorProfile = {
  club_name?: string | null;
  name?: string | null;
  username?: string | null;
};

export type ExpoPushMessage = {
  body: string;
  channelId?: string;
  data?: Record<string, string>;
  sound?: "default";
  title: string;
  to: string;
};

export type ExpoPushTicket = {
  errorCode?: string;
  message?: string;
  status: "error" | "ok";
  ticketId?: string;
};

export type ExpoPushBatchResult = {
  raw: unknown;
  tickets: ExpoPushTicket[];
  transportError?: string;
  transportStatus?: number;
};

const DEFAULT_PUSH_TITLE = "UniVerse";
const EXPO_ACCESS_TOKEN = String(Deno.env.get("EXPO_ACCESS_TOKEN") || "").trim();
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const EXPO_PUSH_BATCH_LIMIT = 100;
const EXPO_PUSH_BATCH_DELAY_MS = 60;

function clampText(value: string, maxLength: number) {
  const normalized = String(value || "").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizePushText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicatePushSegment(left: string, right: string) {
  if (!left || !right) return false;
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function withActorPrefix(actorDisplayName: string, message: string) {
  if (!actorDisplayName) return message;
  if (!message) return actorDisplayName;
  return `${actorDisplayName} ${message}`;
}

function normalizeExpoPushTicket(value: unknown): ExpoPushTicket {
  if (!value || typeof value !== "object") {
    return {
      message: "invalid-expo-ticket",
      status: "error",
    };
  }
  const item = value as Record<string, unknown>;
  const status = item.status === "ok" ? "ok" : "error";
  return {
    errorCode:
      item.details && typeof item.details === "object"
        ? String((item.details as Record<string, unknown>).error || "").trim() || undefined
        : undefined,
    message: String(item.message || "").trim() || undefined,
    status,
    ticketId: status === "ok" ? String(item.id || "").trim() || undefined : undefined,
  };
}

export function buildPushBody(notification: NotificationDispatchRecord) {
  const type = normalizePushText(notification.type);
  const message = normalizePushText(notification.message);
  const detail = normalizePushText(notification.detail);

  if (detail && !isDuplicatePushSegment(message, detail)) {
    switch (type) {
      case "comment":
        return clampText(`Yorum: ${detail}`, 250);
      case "like":
        return clampText(`Icerik: ${detail}`, 250);
      case "event":
      case "join":
      case "join_request":
      case "join_accepted":
      case "join_rejected":
        return clampText(`Etkinlik: ${detail}`, 250);
      default:
        if (message) {
          return clampText(`${message}: ${detail}`, 250);
        }
        return clampText(detail, 250);
    }
  }

  if (message) {
    return clampText(message, 250);
  }

  return "Yeni bir bildirimin var.";
}

export function buildPushData(
  notification: NotificationDispatchRecord,
  actor?: Pick<PushActorProfile, "username"> | null,
) {
  const data: Record<string, string> = {
    notificationId: String(notification.id || "").trim(),
  };
  const type = String(notification.type || "").trim();
  if (type) data.type = type;
  const eventId = String(notification.event_id || "").trim();
  if (eventId) data.eventId = eventId;
  const photoId = String(notification.photo_id || "").trim();
  if (photoId) data.photoId = photoId;
  const targetProfileId = String(notification.target_profile_id || "").trim();
  if (targetProfileId) data.targetProfileId = targetProfileId;
  const fromUsername = String(actor?.username || "").trim();
  if (fromUsername) data.fromUsername = fromUsername;
  data.targetType = photoId ? "album" : eventId ? "event" : "profile";
  return data;
}

export function buildPushTitle(
  type: string,
  actor: PushActorProfile | null,
  notification?: Pick<NotificationDispatchRecord, "message"> | null,
) {
  const actorDisplayName = clampText(
    normalizePushText(actor?.name || actor?.club_name || actor?.username || ""),
    80,
  );
  const message = normalizePushText(notification?.message);
  if (
    actorDisplayName &&
    message &&
    (type === "comment" ||
      type === "join" ||
      type === "join_accepted" ||
      type === "join_rejected" ||
      type === "join_request" ||
      type === "follow" ||
      type === "follow_accepted" ||
      type === "follow_request" ||
      type === "like" ||
      type === "event")
  ) {
    return clampText(withActorPrefix(actorDisplayName, message), 120);
  }
  if (actorDisplayName) {
    return actorDisplayName;
  }
  switch (type) {
    case "comment":
      return "Yeni yorum";
    case "event":
      return "Etkinlik bildirimi";
    case "join":
      return "Etkinlige katilim";
    case "join_accepted":
      return "Katilim onaylandi";
    case "join_rejected":
      return "Katilim reddedildi";
    case "join_request":
      return "Yeni katilim istegi";
    case "follow":
      return "Yeni takipci";
    case "follow_accepted":
      return "Takip istegi kabul edildi";
    case "follow_request":
      return "Yeni takip istegi";
    case "like":
      return "Yeni begeni";
    case "system":
      return DEFAULT_PUSH_TITLE;
    default:
      return DEFAULT_PUSH_TITLE;
  }
}

export function isPushEnabled(preferences: unknown) {
  if (!preferences || typeof preferences !== "object") return true;
  return (preferences as Record<string, unknown>).push !== false;
}

export function isRecoverableInactiveTokenError(ticket: ExpoPushTicket) {
  const message = String(ticket.message || "").toLowerCase();
  const errorCode = String(ticket.errorCode || "").toLowerCase();
  return (
    errorCode === "devicenotregistered" ||
    message.includes("device not registered") ||
    message.includes("not a registered push notification recipient") ||
    message.includes("push token is invalid")
  );
}

export function normalizePushAppEnv(value: unknown): PushAppEnv | null {
  return value === "development" || value === "preview" || value === "production" ? value : null;
}

export function normalizePushPlatform(value: unknown): PushPlatform | null {
  return value === "android" || value === "ios" ? value : null;
}

export function parseNotificationDispatchId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const item = body as Record<string, unknown>;
  const directNotificationId = String(item.notificationId || "").trim();
  if (directNotificationId) return directNotificationId;
  const schema = String(item.schema || "").trim();
  const table = String(item.table || "").trim();
  const eventType = String(item.type || "")
    .trim()
    .toUpperCase();
  if (schema !== "public" || table !== "notifications" || eventType !== "INSERT") {
    return null;
  }
  const record = item.record;
  if (!record || typeof record !== "object") return null;
  return String((record as Record<string, unknown>).id || "").trim() || null;
}

export function isPushDispatchWakeupRequest(body: unknown) {
  if (!body || typeof body !== "object") return false;
  return (body as Record<string, unknown>).drain === true;
}

export function resolvePushDispatchEnv() {
  return EDGE_APP_ENV;
}

export function validateExpoPushToken(value: unknown) {
  return EXPO_PUSH_TOKEN_PATTERN.test(String(value || "").trim());
}

export function isRetryablePushTicketError(ticket: ExpoPushTicket, transportError?: string) {
  const message = `${String(ticket.message || "")} ${String(transportError || "")}`.toLowerCase();
  const errorCode = String(ticket.errorCode || "").toLowerCase();
  if (!message && !errorCode) return false;
  if (isRecoverableInactiveTokenError(ticket)) return false;
  return (
    errorCode === "messageratetexceeded" ||
    message.includes("429") ||
    message.includes("network") ||
    message.includes("rate") ||
    message.includes("service unavailable") ||
    message.includes("timeout") ||
    message.includes("time out") ||
    message.includes("too many requests") ||
    message.includes("unavailable")
  );
}

async function delay(delayMs: number) {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushBatchResult> {
  if (messages.length === 0) {
    return { raw: null, tickets: [] };
  }

  const headers = new Headers({
    accept: "application/json",
    "accept-encoding": "gzip, deflate",
    "content-type": "application/json",
  });
  if (EXPO_ACCESS_TOKEN) {
    headers.set("authorization", `Bearer ${EXPO_ACCESS_TOKEN}`);
  }

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      body: JSON.stringify(messages),
      headers,
      method: "POST",
    });
    const raw = await response.json().catch(() => null);
    const rawTickets = Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
    const tickets = messages.map((_, index) =>
      normalizeExpoPushTicket(
        rawTickets[index] || {
          message: response.ok ? "missing-expo-ticket" : `http-${response.status}`,
        },
      ),
    );
    return {
      raw,
      tickets,
      transportError: response.ok ? undefined : `http-${response.status}`,
      transportStatus: response.status,
    };
  } catch (error) {
    const message = String((error as { message?: string })?.message || error || "push-send-failed");
    return {
      raw: null,
      tickets: messages.map(() => ({
        message,
        status: "error",
      })),
      transportError: message,
    };
  }
}

export async function sendExpoPushBatches(
  messages: ExpoPushMessage[],
): Promise<ExpoPushBatchResult> {
  if (messages.length <= EXPO_PUSH_BATCH_LIMIT) {
    return sendExpoPushBatch(messages);
  }

  const raw: unknown[] = [];
  const tickets: ExpoPushTicket[] = [];
  const transportErrors: string[] = [];
  let transportStatus: number | undefined;

  for (let index = 0; index < messages.length; index += EXPO_PUSH_BATCH_LIMIT) {
    if (index > 0) {
      await delay(EXPO_PUSH_BATCH_DELAY_MS);
    }
    const batchResult = await sendExpoPushBatch(
      messages.slice(index, index + EXPO_PUSH_BATCH_LIMIT),
    );
    raw.push(batchResult.raw);
    tickets.push(...batchResult.tickets);
    if (batchResult.transportError) {
      transportErrors.push(batchResult.transportError);
    }
    if (typeof batchResult.transportStatus === "number") {
      transportStatus = batchResult.transportStatus;
    }
  }

  return {
    raw,
    tickets,
    transportError: transportErrors.length > 0 ? transportErrors.join("; ") : undefined,
    transportStatus,
  };
}
