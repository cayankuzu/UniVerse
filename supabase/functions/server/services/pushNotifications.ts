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

export type ExpoProjectPushMessage = {
  message: ExpoPushMessage;
  projectId?: string | null;
};

export type ExpoPushTicket = {
  errorCode?: string;
  message?: string;
  status: "error" | "ok";
  ticketId?: string;
  retryAfterSeconds?: number;
  transportError?: string;
  transportStatus?: number;
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
const EXPO_PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUSH_INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_PUSH_BATCH_LIMIT = 100;
const EXPO_PUSH_BATCH_DELAY_MS = 60;
// A consumed database lease is renewed for 30 seconds immediately before provider I/O. Keep the
// complete HTTP request (including response body parsing) comfortably below that boundary.
const EXPO_PUSH_REQUEST_TIMEOUT_MS = 8_000;
const EXPO_RETRY_AFTER_MAX_SECONDS = 15 * 60;

function normalizeRetryAfterSeconds(value: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const numericSeconds = Number(normalized);
  const seconds = Number.isFinite(numericSeconds)
    ? Math.ceil(numericSeconds)
    : Math.ceil((Date.parse(normalized) - Date.now()) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.min(EXPO_RETRY_AFTER_MAX_SECONDS, seconds);
}

function normalizeExpoPushTicket(value: unknown): ExpoPushTicket {
  if (!value || typeof value !== "object") {
    return {
      message: "invalid-expo-ticket",
      status: "error",
    };
  }
  const item = value as Record<string, unknown>;
  const ticketId = String(item.id || "").trim();
  if (item.status === "ok" && !ticketId) {
    return {
      errorCode: "MalformedExpoTicket",
      message: "expo-ok-ticket-missing-id",
      status: "error",
    };
  }
  const status = item.status === "ok" && ticketId ? "ok" : "error";
  return {
    errorCode:
      item.details && typeof item.details === "object"
        ? String((item.details as Record<string, unknown>).error || "").trim() || undefined
        : undefined,
    message: String(item.message || "").trim() || undefined,
    status,
    ticketId: status === "ok" ? ticketId : undefined,
  };
}

function normalizeExpoRequestError(value: unknown, status: number) {
  const errors = Array.isArray((value as { errors?: unknown })?.errors)
    ? (value as { errors: unknown[] }).errors || []
    : [];
  const firstError = errors[0];
  if (!firstError || typeof firstError !== "object") {
    return {
      errorCode: undefined,
      message: `http-${status}`,
    };
  }
  const item = firstError as Record<string, unknown>;
  return {
    errorCode: String(item.code || "").trim() || undefined,
    message: String(item.message || `http-${status}`).trim(),
  };
}

export function buildPushBody(_notification: NotificationDispatchRecord) {
  // A token can be reassigned after the final database check but before the provider accepts the
  // request. Never put actor/content data on the lock screen; the authenticated projection is the
  // only source for notification details after the app opens.
  return "Yeni bir bildirimin var.";
}

export function buildPushData(
  notification: NotificationDispatchRecord,
  _actor?: Pick<PushActorProfile, "username"> | null,
) {
  return { notificationId: String(notification.id || "").trim() };
}

export function buildPushTitle(
  _type: string,
  _actor: PushActorProfile | null,
  _notification?: Pick<NotificationDispatchRecord, "message"> | null,
) {
  return DEFAULT_PUSH_TITLE;
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

export function normalizeExpoProjectId(value: unknown) {
  const normalized = String(value || "").trim();
  return EXPO_PROJECT_ID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

export function normalizePushInstallationId(value: unknown) {
  const normalized = String(value || "").trim();
  return PUSH_INSTALLATION_ID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
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
  if (ticket.retryAfterSeconds && ticket.retryAfterSeconds > 0) return true;
  if (!message && !errorCode) return false;
  if (isRecoverableInactiveTokenError(ticket)) return false;
  return (
    errorCode === "messageratetexceeded" ||
    errorCode === "malformedexpoticket" ||
    message.includes("429") ||
    message.includes("network") ||
    message.includes("rate") ||
    message.includes("service unavailable") ||
    message.includes("timeout") ||
    message.includes("time out") ||
    message.includes("missing-expo-ticket") ||
    message.includes("expo-ok-ticket-missing-id") ||
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPO_PUSH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      body: JSON.stringify(messages),
      headers,
      method: "POST",
      signal: controller.signal,
    });
    const raw = await response.json().catch(() => null);
    const rawTickets = Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
    const requestError = response.ok ? null : normalizeExpoRequestError(raw, response.status);
    const transportError = response.ok ? undefined : `http-${response.status}`;
    const retryAfterSeconds = normalizeRetryAfterSeconds(response.headers.get("retry-after"));
    const tickets = messages.map((_, index) => {
      const ticket = normalizeExpoPushTicket(
        rawTickets[index] || {
          details: requestError?.errorCode ? { error: requestError.errorCode } : undefined,
          message: response.ok ? "missing-expo-ticket" : requestError?.message,
        },
      );
      return {
        ...ticket,
        ...(transportError ? { transportError, transportStatus: response.status } : {}),
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      } satisfies ExpoPushTicket;
    });
    return {
      raw,
      tickets,
      transportError,
      transportStatus: response.status,
    };
  } catch (error) {
    const message = controller.signal.aborted
      ? "provider-timeout"
      : `provider-network-error:${String(
          (error as { message?: string })?.message || error || "push-send-failed",
        ).slice(0, 300)}`;
    return {
      raw: null,
      tickets: messages.map(() => ({
        message,
        status: "error",
        transportError: message,
      })),
      transportError: message,
    };
  } finally {
    clearTimeout(timeout);
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

export async function sendExpoPushBatchesByProject(
  entries: ExpoProjectPushMessage[],
): Promise<ExpoPushBatchResult> {
  if (entries.length === 0) {
    return { raw: null, tickets: [] };
  }

  const groups = new Map<string, Array<{ index: number; message: ExpoPushMessage }>>();
  entries.forEach((entry, index) => {
    const projectId = String(entry.projectId || "").trim();
    // Legacy rows predate project attribution. Keep each one isolated so a
    // mixed-experience request cannot make otherwise valid messages fail.
    const groupKey = projectId ? `project:${projectId}` : `legacy:${index}`;
    const group = groups.get(groupKey) || [];
    group.push({ index, message: entry.message });
    groups.set(groupKey, group);
  });

  const tickets: ExpoPushTicket[] = entries.map(() => ({
    message: "missing-expo-ticket",
    status: "error",
  }));
  const raw: unknown[] = [];
  const transportErrors: string[] = [];
  let transportStatus: number | undefined;

  await Promise.all(
    Array.from(groups.entries()).map(async ([groupKey, group]) => {
      const result = await sendExpoPushBatches(group.map((item) => item.message));
      raw.push({ groupKey, response: result.raw });
      group.forEach((item, groupIndex) => {
        tickets[item.index] = result.tickets[groupIndex] || tickets[item.index];
      });
      if (result.transportError) transportErrors.push(result.transportError);
      if (typeof result.transportStatus === "number") transportStatus = result.transportStatus;
    }),
  );

  return {
    raw,
    tickets,
    transportError: transportErrors.length > 0 ? transportErrors.join("; ") : undefined,
    transportStatus,
  };
}
