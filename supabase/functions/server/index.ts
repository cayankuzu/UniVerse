import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.ts";
import { logEdgeRequest, logError, logInfo } from "./logging.ts";
import {
  AUTH_RECOVERY_ENDPOINTS_ENABLED,
  COMPAT_ROUTES_ENABLED,
  readRequiredEdgeEnv,
} from "./runtime.ts";
import { registerPrimaryRoutes, registerRollbackCompatRoutes } from "./routeRegistry.ts";
import { isMediaScannerConfigured } from "./routes/storageMediaScan.ts";
import {
  buildUserDeletionContext as buildDeletionContext,
  purgeUserAccountData as purgeDeletionData,
} from "./services/accountDeletion.ts";
import { createBlockedStateReader } from "./services/blockedState.ts";
import {
  CloudflareOriginVerificationError,
  readCloudflareOriginVerificationConfig,
  verifyCloudflareOriginRequest,
  type OriginNonceClaim,
} from "./services/cloudflareOriginVerification.ts";
import { createProfileStore } from "./services/profileStore.ts";
import { triggerInlinePushDispatchDrain } from "./services/pushDispatchDrain.ts";
import { isSqlBlockedPair } from "./services/sqlBlockedState.ts";
import type {
  EdgeRouteContext,
  EdgeUser,
  EnrichedKvEventRecord,
  KvBlockedRecord,
  KvBooleanRecord,
  KvCommentRecord,
  KvEventRecord,
  KvNotificationRecord,
  NotificationInsertPayload,
  ServerRouteDeps,
} from "./types.ts";
import { markVerifiedClientNetworkKey } from "./services/verifiedClientNetwork.ts";

const app = new Hono().basePath("/server");

const SUPABASE_URL = readRequiredEdgeEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = readRequiredEdgeEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");
const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const cloudflareOriginVerificationConfig = readCloudflareOriginVerificationConfig({
  maxClockSkewSeconds: Deno.env.get("CLOUDFLARE_ORIGIN_MAX_CLOCK_SKEW_SECONDS"),
  mode: Deno.env.get("CLOUDFLARE_ORIGIN_VERIFICATION_MODE"),
  secret: Deno.env.get("ORIGIN_HMAC_SECRET"),
});
const KV_TABLE = "kv_store_e3557d40";
const MEDIA_BUCKET = "make-e3557d40-media";
const SLOW_REQUEST_MS = Number(Deno.env.get("EDGE_SLOW_REQUEST_MS") || "400");
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:19006",
  "https://localhost",
];
const ALLOWED_CORS_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...String(Deno.env.get("EDGE_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

function shouldAttemptInlinePushDrain(params: {
  method: string;
  path: string;
  responseStatus: number;
}) {
  const method = String(params.method || "").toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "DELETE") {
    return false;
  }
  if (params.responseStatus < 200 || params.responseStatus >= 300) {
    return false;
  }
  return (
    params.path !== "/server/make-server-e3557d40/health" &&
    !params.path.includes("/push/register") &&
    !params.path.includes("/push/unregister") &&
    !params.path.includes("/push/dispatch")
  );
}

app.use("*", async (c, next) => {
  const startedAt = performance.now();
  try {
    await next();
    if (
      shouldAttemptInlinePushDrain({
        method: c.req.method,
        path: c.req.path,
        responseStatus: c.res?.status ?? 0,
      })
    ) {
      void triggerInlinePushDispatchDrain({
        adminSupabase,
        batchLimit: 1,
        maxPasses: 1,
        requestPath: c.req.path,
      }).catch((error) => {
        logError("push/dispatch-inline", "push-dispatch-inline-trigger-failed", error, {
          path: c.req.path,
        });
      });
    }
  } finally {
    const elapsedMs = Math.round(performance.now() - startedAt);
    logEdgeRequest({
      elapsedMs,
      method: c.req.method,
      path: c.req.path,
      slow: elapsedMs > SLOW_REQUEST_MS,
      status: c.res?.status ?? 0,
    });
  }
});

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      return ALLOWED_CORS_ORIGINS.has(origin) ? origin : "";
    },
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

async function claimCloudflareOriginNonce(claim: OriginNonceClaim) {
  const { data, error } = await adminSupabase.rpc("claim_cloudflare_origin_request_nonce", {
    p_expires_at: claim.expiresAt,
    p_nonce: claim.nonce,
    p_request_id: claim.requestId,
    p_request_timestamp: claim.requestTimestamp,
    p_route_id: claim.routeId,
  });
  if (error) {
    throw new Error(`cloudflare-origin-nonce-claim-failed:${error.code || "unknown"}`);
  }
  return data === true;
}

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  try {
    const result = await verifyCloudflareOriginRequest(
      c.req.raw,
      cloudflareOriginVerificationConfig,
      { claimNonce: claimCloudflareOriginNonce },
    );
    if (result.outcome === "observed_unsigned") {
      logInfo("origin-verification", "unsigned-selected-route-observed", {
        method: c.req.method,
        path: c.req.path,
        routeId: result.routeId,
      });
    }
    if (result.outcome === "verified" && result.clientNetworkKey) {
      markVerifiedClientNetworkKey(c.req.raw, result.clientNetworkKey);
    }
    await next();
  } catch (error) {
    if (!(error instanceof CloudflareOriginVerificationError)) throw error;
    const logMeta = {
      code: error.code,
      method: c.req.method,
      path: c.req.path,
    };
    if (error.status >= 500) {
      logError("origin-verification", "selected-route-verification-unavailable", error, logMeta);
    } else {
      logInfo("origin-verification", "selected-route-verification-rejected", logMeta);
    }
    return new Response(JSON.stringify({ error: "Origin request verification failed." }), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      status: error.status,
    });
  }
});

function generateId() {
  return crypto.randomUUID();
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Simdi";
  if (mins < 60) return `${mins} dakika once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat once`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gun once`;
  return `${Math.floor(days / 7)} hafta once`;
}

async function getUser(c: EdgeRouteContext): Promise<EdgeUser | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) {
    logError("auth", "get-user-no-token", new Error("Authorization header missing or empty"), {
      path: c.req.path,
    });
    return null;
  }
  try {
    const {
      data: { user },
    } = await adminSupabase.auth.getUser(token);
    if (!user?.id) {
      logError("auth", "get-user-empty-response", new Error("getUser returned no user id"), {
        path: c.req.path,
        hasData: Boolean(user),
      });
      return null;
    }
    return {
      email: user.email,
      id: user.id,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    };
  } catch (error) {
    logError("auth", "get-user-failed", error instanceof Error ? error : new Error(String(error)), {
      path: c.req.path,
    });
    return null;
  }
}

async function addNotification(userId: string, data: NotificationInsertPayload) {
  try {
    const normalizedUserId = String(userId || "").trim();
    const actorUserId = String(data.fromUserId || "").trim();
    if (!normalizedUserId || !actorUserId || normalizedUserId === actorUserId) {
      return;
    }
    if (await isSqlBlockedPair(adminSupabase, normalizedUserId, actorUserId)) {
      return;
    }
    const notifs =
      (await kv.get<KvNotificationRecord[]>(`notifications:${normalizedUserId}`)) || [];
    notifs.unshift({ id: generateId(), ...data, read: false, createdAt: new Date().toISOString() });
    if (notifs.length > 100) notifs.splice(100);
    await kv.set(`notifications:${normalizedUserId}`, notifs);
  } catch (error) {
    logError("notifications", "notification-persist-failed", error, { userId });
  }
}

async function enrichEvent(event: KvEventRecord, userId: string): Promise<EnrichedKvEventRecord> {
  const [likes, attendees, comments] = await Promise.all([
    kv.get<KvBooleanRecord>(`eventlikes:${event.id}`).then((value) => value || {}),
    kv.get<string[]>(`eventattendees:${event.id}`).then((value) => value || []),
    kv.get<KvCommentRecord[]>(`eventcomments:${event.id}`).then((value) => value || []),
  ]);
  return {
    ...event,
    likes: Object.values(likes).filter(Boolean).length,
    liked: Boolean(likes[userId]),
    attendees: attendees.length,
    joined: attendees.includes(userId),
    comments: comments.length,
  };
}

const USERNAME_REGEX = /^[a-z0-9_]+$/;

function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const profileStore = createProfileStore({
  adminSupabase,
  kvTable: KV_TABLE,
  normalizeEmail,
  normalizeUsername,
});

async function loadBlockedRows(userId: string) {
  return kv.get<KvBlockedRecord[]>(`blocked:${userId}`).then((value) => value || []);
}

const compatBlockedStateReader = createBlockedStateReader({ loadBlockedRows });

async function isKvBlockedPair(a: string, b: string): Promise<boolean> {
  return compatBlockedStateReader.isBlockedPair(a, b);
}

async function filterBlockedRowsForViewer<T extends { id?: string; userId?: string }>(
  viewerId: string,
  rows: T[],
) {
  return compatBlockedStateReader.filterRowsForViewer(viewerId, rows);
}

const routeDeps: ServerRouteDeps = {
  adminSupabase,
  USERNAME_REGEX,
  addNotification,
  buildUserDeletionContext: (userId) =>
    buildDeletionContext({
      adminSupabase,
      userId,
    }),
  enrichEvent,
  filterBlockedRowsForViewer,
  generateId,
  getUser,
  isKvBlockedPair,
  loadCanonicalProfile: profileStore.loadCanonicalProfile,
  migrateClubUsernameDependencies: profileStore.migrateClubUsernameDependencies,
  normalizeEmail,
  normalizeUsername,
  persistProfile: profileStore.persistProfile,
  purgeUserAccountData: (userId, context) =>
    purgeDeletionData({
      adminSupabase,
      context,
      kvTable: KV_TABLE,
      mediaBucket: MEDIA_BUCKET,
      normalizeEmail,
      normalizeUsername,
      userId,
    }),
  syncClubEventProfileFields: profileStore.syncClubEventProfileFields,
  syncProfileToTable: profileStore.syncProfileToTable,
  timeAgo,
};

app.get("/make-server-e3557d40/health", (c) =>
  c.json({
    authRecoveryEndpointsEnabled: AUTH_RECOVERY_ENDPOINTS_ENABLED,
    compatRoutesEnabled: COMPAT_ROUTES_ENABLED,
    legacyEdgeReadsEnabled: false,
    mediaScannerConfigured: isMediaScannerConfigured(),
    status: "ok",
  }),
);
registerPrimaryRoutes(app, routeDeps);
registerRollbackCompatRoutes(app, routeDeps);

app.onError((error, c) => {
  logError("edge/unhandled", "unhandled-edge-error", error, {
    method: c.req.method,
    path: c.req.path,
  });
  return c.json({ error: "Beklenmeyen sunucu hatasi." }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

Deno.serve(app.fetch);
