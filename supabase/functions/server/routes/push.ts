import { logError, logInfo } from "../logging.ts";
import { consumeRateLimit, getRequestClientAddress } from "../rateLimit.ts";
import { IS_DEVELOPMENT_EDGE, IS_PRODUCTION_EDGE } from "../runtime.ts";
import type { EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import {
  isPushDispatchWakeupRequest,
  normalizeExpoProjectId,
  normalizePushAppEnv,
  normalizePushPlatform,
  parseNotificationDispatchId,
  validateExpoPushToken,
} from "../services/pushNotifications.ts";
import { enqueueNotificationPushDispatch } from "../services/pushDispatchQueue.ts";
import { drainNotificationPushDispatchQueue } from "../services/pushDispatchDrain.ts";
import { reconcilePendingPushReceipts } from "../services/pushReceiptProcessor.ts";

const PUSH_DISPATCH_WEBHOOK_SECRET = String(
  Deno.env.get("PUSH_DISPATCH_WEBHOOK_SECRET") || "",
).trim();
const PUSH_DISPATCH_SERVICE_ROLE_KEY = String(
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "",
).trim();
const PUSH_REGISTER_RATE_LIMIT = 10;
const PUSH_REGISTER_RATE_WINDOW_MS = 60_000;
const PUSH_PUBLIC_WAKEUP_RATE_LIMIT = 600;
const PUSH_PUBLIC_WAKEUP_RATE_WINDOW_MS = 60_000;
const PUSH_PUBLIC_WAKEUP_BATCH_LIMIT = 8;
const PUSH_PUBLIC_WAKEUP_MAX_PASSES = 2;

type PushRegistrationBody = {
  appEnv?: unknown;
  expoProjectId?: unknown;
  expoPushToken?: unknown;
  platform?: unknown;
};

function parsePushRegistrationBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const item = body as PushRegistrationBody;
  const expoPushToken = String(item.expoPushToken || "").trim();
  const rawExpoProjectId = String(item.expoProjectId || "").trim();
  const expoProjectId = rawExpoProjectId ? normalizeExpoProjectId(rawExpoProjectId) : null;
  const platform = normalizePushPlatform(item.platform);
  const appEnv = normalizePushAppEnv(item.appEnv);
  if (
    !expoPushToken ||
    (rawExpoProjectId && !expoProjectId) ||
    !platform ||
    !appEnv ||
    !validateExpoPushToken(expoPushToken)
  ) {
    return null;
  }
  return {
    appEnv,
    expoProjectId,
    expoPushToken,
    platform,
  };
}

function resolvePushDispatchAuthorization(headerValue: string) {
  const normalized = String(headerValue || "").trim();
  if (!normalized) return "";
  return normalized.startsWith("Bearer ") ? normalized.slice(7).trim() : normalized;
}

function isAuthorizedPushDispatchRequest(c: {
  req: { header: (name: string) => string | undefined };
}) {
  const authorizationHeader = String(c.req.header("Authorization") || "").trim();
  const apikeyHeader = String(c.req.header("apikey") || "").trim();
  const webhookSecretHeader = String(c.req.header("x-webhook-secret") || "").trim();
  const normalizedAuthorization = resolvePushDispatchAuthorization(authorizationHeader);

  if (
    PUSH_DISPATCH_WEBHOOK_SECRET &&
    (webhookSecretHeader === PUSH_DISPATCH_WEBHOOK_SECRET ||
      normalizedAuthorization === PUSH_DISPATCH_WEBHOOK_SECRET)
  ) {
    return true;
  }

  if (!PUSH_DISPATCH_SERVICE_ROLE_KEY) {
    return false;
  }

  return (
    apikeyHeader === PUSH_DISPATCH_SERVICE_ROLE_KEY ||
    normalizedAuthorization === PUSH_DISPATCH_SERVICE_ROLE_KEY
  );
}

function canBypassPushDispatchAuthorizationInDevelopment(body: unknown) {
  if (!IS_DEVELOPMENT_EDGE) return false;
  return Boolean(parseNotificationDispatchId(body) || isPushDispatchWakeupRequest(body));
}

export function registerPushRoutes(
  app: EdgeRouteApp,
  deps: Pick<ServerRouteDeps, "adminSupabase" | "getUser">,
) {
  const { adminSupabase, getUser } = deps;

  app.post("/make-server-e3557d40/push/register", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const allowed = await consumeRateLimit({
      limit: PUSH_REGISTER_RATE_LIMIT,
      scope: "push-register",
      subject: user.id,
      windowMs: PUSH_REGISTER_RATE_WINDOW_MS,
    });
    if (!allowed) return c.json({ error: "Rate limit exceeded" }, 429);

    const body = await c.req.json().catch(() => null);
    const payload = parsePushRegistrationBody(body);
    if (!payload) {
      return c.json({ error: "Invalid push token payload" }, 400);
    }

    const now = new Date().toISOString();
    const { error } = await adminSupabase.from("push_device_tokens").upsert(
      {
        app_env: payload.appEnv,
        ...(payload.expoProjectId ? { expo_project_id: payload.expoProjectId } : {}),
        expo_push_token: payload.expoPushToken,
        is_active: true,
        last_registered_at: now,
        last_seen_at: now,
        platform: payload.platform,
        user_id: user.id,
      },
      {
        onConflict: "expo_push_token",
      },
    );

    if (error) {
      logError("push/register", "push-token-register-failed", error, {
        appEnv: payload.appEnv,
        platform: payload.platform,
        userId: user.id,
      });
      return c.json({ error: "Push token kaydedilemedi." }, 500);
    }

    return c.json({ success: true });
  });

  app.post("/make-server-e3557d40/push/unregister", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const expoPushToken = String((body as { expoPushToken?: unknown })?.expoPushToken || "").trim();
    if (!validateExpoPushToken(expoPushToken)) {
      return c.json({ error: "Invalid push token payload" }, 400);
    }

    const { error } = await adminSupabase
      .from("push_device_tokens")
      .update({
        is_active: false,
        last_seen_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("expo_push_token", expoPushToken);

    if (error) {
      logError("push/unregister", "push-token-unregister-failed", error, {
        userId: user.id,
      });
      return c.json({ error: "Push token kaldirilamadi." }, 500);
    }

    return c.json({ success: true });
  });

  app.post("/make-server-e3557d40/push/dispatch", async (c) => {
    const body = await c.req.json().catch(() => null);
    const wakeupRequest = isPushDispatchWakeupRequest(body);
    const notificationId = parseNotificationDispatchId(body);
    const authBypassedInDevelopment = canBypassPushDispatchAuthorizationInDevelopment(body);
    const isAuthorizedRequest = authBypassedInDevelopment || isAuthorizedPushDispatchRequest(c);

    // Database wakeups only drain the already-enqueued queue. Keep direct
    // notification-id enqueue reserved for authorized callers.
    if (!isAuthorizedRequest && !wakeupRequest) {
      if (IS_PRODUCTION_EDGE) {
        logError(
          "push/dispatch",
          "push-dispatch-unauthorized",
          new Error("Unauthorized push dispatch request"),
          {
            hasApiKeyHeader: Boolean(c.req.header("apikey")),
            hasAuthorizationHeader: Boolean(c.req.header("Authorization")),
            hasWebhookSecretHeader: Boolean(c.req.header("x-webhook-secret")),
          },
        );
      }
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!isAuthorizedRequest && wakeupRequest) {
      const allowed = await consumeRateLimit({
        limit: PUSH_PUBLIC_WAKEUP_RATE_LIMIT,
        scope: "push-dispatch-public-wakeup",
        subject: getRequestClientAddress(c),
        windowMs: PUSH_PUBLIC_WAKEUP_RATE_WINDOW_MS,
      });
      if (!allowed) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }
    }

    if (authBypassedInDevelopment) {
      logInfo("push/dispatch", "push-dispatch-auth-bypassed-development", {
        hasApiKeyHeader: Boolean(c.req.header("apikey")),
        hasAuthorizationHeader: Boolean(c.req.header("Authorization")),
        hasWebhookSecretHeader: Boolean(c.req.header("x-webhook-secret")),
      });
    }

    if (!notificationId && !wakeupRequest) {
      return c.json({ error: "Invalid notification dispatch payload" }, 400);
    }

    if (notificationId && isAuthorizedRequest) {
      const enqueueError = await enqueueNotificationPushDispatch(adminSupabase, notificationId);
      if (enqueueError) {
        return c.json({ error: "Push dispatch queue unavailable" }, 500);
      }
    }

    const publicWakeupRequest = wakeupRequest && !isAuthorizedRequest;
    const drainResult = await drainNotificationPushDispatchQueue({
      adminSupabase,
      batchLimit: publicWakeupRequest ? PUSH_PUBLIC_WAKEUP_BATCH_LIMIT : undefined,
      maxPasses: publicWakeupRequest ? PUSH_PUBLIC_WAKEUP_MAX_PASSES : undefined,
    });
    if (drainResult.error) {
      return c.json({ error: "Push dispatch claim failed" }, 500);
    }

    const receiptResult = wakeupRequest
      ? await reconcilePendingPushReceipts(adminSupabase).catch((error) => ({
          checkedCount: 0,
          deactivatedCount: 0,
          error,
          errorCount: 0,
          expiredCount: 0,
          missingCount: 0,
          sentCount: 0,
        }))
      : null;
    const receiptSummary = receiptResult
      ? {
          checkedCount: receiptResult.checkedCount,
          deactivatedCount: receiptResult.deactivatedCount,
          errorCount: receiptResult.errorCount,
          expiredCount: receiptResult.expiredCount,
          failed: Boolean(receiptResult.error),
          missingCount: receiptResult.missingCount,
          sentCount: receiptResult.sentCount,
        }
      : null;
    if (receiptResult?.error) {
      logError("push/receipts", "push-receipt-reconcile-failed", receiptResult.error, {
        expiredCount: receiptResult.expiredCount,
      });
      if (drainResult.processedCount === 0) {
        return c.json({ error: "Push receipt reconciliation failed" }, 502);
      }
    }
    if (drainResult.processedCount === 0) {
      return c.json({
        receipts: receiptSummary,
        success: true,
        skipped: "no-pending-notifications",
      });
    }

    logInfo("push/dispatch", "push-dispatch-drain-finished", {
      failedCount: drainResult.failedCount,
      processedCount: drainResult.processedCount,
      retryCount: drainResult.retryCount,
      sentCount: drainResult.sentCount,
      receiptCheckedCount: receiptSummary?.checkedCount || 0,
      receiptErrorCount: receiptSummary?.errorCount || 0,
    });

    return c.json({
      failedCount: drainResult.failedCount,
      processedCount: drainResult.processedCount,
      retryCount: drainResult.retryCount,
      receipts: receiptSummary,
      sentCount: drainResult.sentCount,
      success: true,
    });
  });
}
