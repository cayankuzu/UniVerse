import { logError } from "../logging.ts";
import { recordSecurityAuditEvent } from "../services/securityAudit.ts";
import type { EdgeRouteApp, EdgeRouteContext, ServerRouteDeps } from "../types.ts";
import {
  DiscoveryRouteValidationError,
  parseUploadSessionCreateRequestBody,
  parseUploadSessionIdRequestBody,
} from "./discoveryRouteValidation.ts";
import type { DiscoveryRouteContext } from "./discoveryRouteContext.ts";
import {
  assertSignedUploadContentType,
  normalizeStorageFolder,
  STORAGE_BUCKET,
  StorageRouteError,
} from "./storagePolicy.ts";
import { removeStorageObjectsOrQueue } from "./storageCleanup.ts";

const UPLOAD_SESSION_RATE_LIMIT_WINDOW_MS = 60_000;
const UPLOAD_SESSION_RATE_LIMIT_MAX = 6;

type DiscoveryStorageUploadSessionDeps = Pick<ServerRouteDeps, "adminSupabase" | "getUser">;

const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/3gpp": "3gp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
};

function normalizePathStem(value: string) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "upload"
  );
}

function buildSessionObjectPath(params: {
  contentType: string;
  folder: string;
  mediaIndex: number;
  mutationId: string;
  userId: string;
}) {
  const extension = CONTENT_TYPE_EXTENSION_MAP[params.contentType] || "bin";
  const mutationStem = normalizePathStem(params.mutationId);
  return `${params.folder}/${params.userId}/${mutationStem}-${params.mediaIndex}.${extension}`;
}

async function ensureOwnSession(params: {
  adminSupabase: DiscoveryStorageUploadSessionDeps["adminSupabase"];
  sessionId: string;
  userId: string;
}) {
  const { data, error } = await params.adminSupabase
    .from("upload_sessions")
    .select("id, owner_id, state")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StorageRouteError("Upload session bulunamadi", 404);
  if (String(data.owner_id || "") !== params.userId) {
    throw new StorageRouteError("Bu upload session icin yetkiniz yok.", 403);
  }
  return data as { id: string; owner_id: string; state: string };
}

async function processOwnerCleanupJobs(params: {
  adminSupabase: DiscoveryStorageUploadSessionDeps["adminSupabase"];
  userId: string;
}) {
  const { data, error } = await params.adminSupabase.rpc("claim_storage_cleanup_jobs", {
    max_jobs: 20,
    target_owner_id: params.userId,
  });
  if (error) throw error;
  const jobs = Array.isArray(data)
    ? (data as Array<{ attempt_count: number; id: string; object_path: string }>)
    : [];
  const storage = params.adminSupabase.storage.from(STORAGE_BUCKET);
  let completed = 0;
  for (const job of jobs) {
    const removal = await storage.remove([job.object_path]);
    const removalError = removal.error;
    const attemptCount = Number(job.attempt_count || 0);
    const deadLettered = Boolean(removalError) && attemptCount >= 20;
    const retryDelayMs = Math.min(6 * 60 * 60_000, 30_000 * 2 ** Math.min(attemptCount, 10));
    const { error: updateError } = await params.adminSupabase
      .from("storage_cleanup_jobs")
      .update({
        completed_at: removalError ? null : new Date().toISOString(),
        last_error: removalError ? String(removalError.message || "storage_remove_failed") : null,
        next_attempt_at: removalError
          ? new Date(Date.now() + retryDelayMs).toISOString()
          : new Date().toISOString(),
        status: removalError ? (deadLettered ? "dead_letter" : "pending") : "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("owner_id", params.userId);
    if (updateError) throw updateError;
    if (removalError) {
      logError("storage/cleanup", "storage-cleanup-retry-failed", removalError, {
        attemptCount,
        deadLettered,
        jobId: job.id,
        userId: params.userId,
      });
    } else {
      completed += 1;
    }
  }
  return { claimed: jobs.length, completed };
}

export function registerStorageUploadSessionRoutes(
  app: EdgeRouteApp,
  deps: DiscoveryStorageUploadSessionDeps,
  routeContext: DiscoveryRouteContext,
) {
  const { adminSupabase, getUser } = deps;

  app.post("/make-server-e3557d40/storage/upload-session/create", async (c: EdgeRouteContext) => {
    let userId = "";
    try {
      await routeContext.initStorageBucket();
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      userId = String(user.id || "").trim();
      const allowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload-session:create",
        userId,
        UPLOAD_SESSION_RATE_LIMIT_MAX,
        UPLOAD_SESSION_RATE_LIMIT_WINDOW_MS,
      );
      if (!allowed) return c.json({ error: "Upload session limiti asildi." }, 429);

      const body = parseUploadSessionCreateRequestBody(await c.req.json().catch(() => ({})));
      const folder = normalizeStorageFolder(body.folder);
      const items = body.items.map((item) => {
        const contentType = assertSignedUploadContentType(item.contentType);
        return {
          contentType,
          expectedChecksum: item.checksum || null,
          expectedSizeBytes: item.expectedSizeBytes || null,
          mediaIndex: item.mediaIndex,
          objectPath: buildSessionObjectPath({
            contentType,
            folder,
            mediaIndex: item.mediaIndex,
            mutationId: body.mutationId,
            userId,
          }),
        };
      });

      if (new Set(items.map((item) => item.mediaIndex)).size !== items.length) {
        throw new StorageRouteError("mediaIndex degerleri benzersiz olmali", 400);
      }

      const { data: existingSession, error: existingSessionError } = await adminSupabase
        .from("upload_sessions")
        .select("id,expected_count,folder,state")
        .eq("owner_id", userId)
        .eq("mutation_id", body.mutationId)
        .maybeSingle();
      if (existingSessionError) throw existingSessionError;
      if (existingSession?.state === "finalized") {
        throw new StorageRouteError("Bu upload session zaten yayinlandi.", 409);
      }
      if (existingSession?.folder && existingSession.folder !== folder) {
        throw new StorageRouteError("Upload session klasoru degistirilemez.", 409);
      }
      const expectedCount = existingSession?.expected_count || items.length;
      if (items.some((item) => item.mediaIndex >= expectedCount)) {
        throw new StorageRouteError("Upload session medya indeksi gecersiz.", 409);
      }

      const { data: session, error: sessionError } = await adminSupabase
        .from("upload_sessions")
        .upsert(
          {
            cancelled_at: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            expected_count: expectedCount,
            failure_reason: null,
            finalized_at: null,
            folder,
            mutation_id: body.mutationId,
            owner_id: userId,
            state: "uploading",
          },
          { onConflict: "owner_id,mutation_id" },
        )
        .select("id")
        .single();
      if (sessionError || !session?.id) throw sessionError || new Error("session_create_failed");

      const rows = items.map((item) => ({
        expected_checksum: item.expectedChecksum,
        expected_content_type: item.contentType,
        expected_size_bytes: item.expectedSizeBytes,
        media_index: item.mediaIndex,
        observed_content_type: null,
        observed_size_bytes: null,
        object_path: item.objectPath,
        owner_id: userId,
        scan_state: "pending",
        session_id: session.id,
        state: "ticketed",
      }));
      const { error: itemError } = await adminSupabase
        .from("upload_session_items")
        .upsert(rows, { onConflict: "session_id,media_index" });
      if (itemError) throw itemError;

      const storage = adminSupabase.storage.from(STORAGE_BUCKET);
      const tickets = [];
      try {
        for (const item of items) {
          const signedUpload = await storage.createSignedUploadUrl(item.objectPath, {
            upsert: true,
          });
          if (signedUpload.error || !signedUpload.data?.signedUrl || !signedUpload.data?.token) {
            throw signedUpload.error || new Error("signed_upload_url_empty");
          }
          tickets.push({
            expectedSizeBytes: item.expectedSizeBytes,
            mediaIndex: item.mediaIndex,
            path: item.objectPath,
            uploadToken: signedUpload.data.token,
            uploadUrl: signedUpload.data.signedUrl,
          });
        }
      } catch (ticketError) {
        const [failedItems, failedSession] = await Promise.all([
          adminSupabase
            .from("upload_session_items")
            .update({ state: "failed" })
            .eq("session_id", session.id)
            .in("state", ["ticketed", "uploaded", "quarantined"]),
          adminSupabase
            .from("upload_sessions")
            .update({ failure_reason: "signed_upload_ticket_failed", state: "failed" })
            .eq("id", session.id),
        ]);
        if (failedItems.error) throw failedItems.error;
        if (failedSession.error) throw failedSession.error;
        throw ticketError;
      }

      await recordSecurityAuditEvent({
        action: "storage.upload_session_create",
        adminSupabase,
        c,
        metadata: { count: tickets.length, folder },
        resourceId: session.id,
        resourceType: "upload_session",
        result: "success",
        userId,
      });

      return c.json({ sessionId: session.id, tickets });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "storage.upload_session_create",
        adminSupabase,
        c,
        resourceType: "upload_session",
        result: error instanceof StorageRouteError && error.status < 500 ? "denied" : "fail",
        userId: userId || null,
      });
      if (error instanceof StorageRouteError) return c.json({ error: error.message }, error.status);
      if (error instanceof DiscoveryRouteValidationError)
        return c.json({ error: error.message }, error.status);
      logError("storage/upload-session/create", "upload-session-create-failed", error, { userId });
      return c.json({ error: "Upload session olusturulamadi." }, 500);
    }
  });

  app.post("/make-server-e3557d40/storage/upload-session/finalize", async (c: EdgeRouteContext) => {
    let userId = "";
    let sessionId = "";
    try {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      userId = String(user.id || "").trim();
      const body = parseUploadSessionIdRequestBody(await c.req.json().catch(() => ({})));
      sessionId = body.sessionId;
      const session = await ensureOwnSession({ adminSupabase, sessionId, userId });

      const { data: items, error: itemsError } = await adminSupabase
        .from("upload_session_items")
        .select("object_path, state")
        .eq("session_id", sessionId);
      if (itemsError) throw itemsError;
      const rows = Array.isArray(items)
        ? (items as Array<{ object_path: string; state: string }>)
        : [];
      if (!rows.length || session.state !== "finalized") {
        return c.json(
          {
            error:
              "Upload session yalnizca dogrulanmis album atomik olarak yayinlandiginda finalize olur.",
          },
          409,
        );
      }
      const invalid = rows.filter((item) => item.state !== "finalized");
      if (invalid.length > 0) throw new Error("finalized_session_contains_unfinalized_items");

      await recordSecurityAuditEvent({
        action: "storage.upload_session_finalize",
        adminSupabase,
        c,
        metadata: { count: rows.length },
        resourceId: sessionId,
        resourceType: "upload_session",
        result: "success",
        userId,
      });
      return c.json({ paths: rows.map((item) => item.object_path), sessionId });
    } catch (error) {
      if (error instanceof StorageRouteError) return c.json({ error: error.message }, error.status);
      if (error instanceof DiscoveryRouteValidationError)
        return c.json({ error: error.message }, error.status);
      logError("storage/upload-session/finalize", "upload-session-finalize-failed", error, {
        userId,
        sessionId,
      });
      return c.json({ error: "Upload session finalize edilemedi." }, 500);
    }
  });

  app.post("/make-server-e3557d40/storage/upload-session/cancel", async (c: EdgeRouteContext) => {
    let userId = "";
    let sessionId = "";
    try {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      userId = String(user.id || "").trim();
      const body = parseUploadSessionIdRequestBody(await c.req.json().catch(() => ({})));
      sessionId = body.sessionId;
      const session = await ensureOwnSession({ adminSupabase, sessionId, userId });
      if (session.state === "finalized") {
        return c.json({ error: "Yayinlanmis upload session iptal edilemez." }, 409);
      }

      const { data: items, error: itemsError } = await adminSupabase
        .from("upload_session_items")
        .select("object_path")
        .eq("session_id", sessionId);
      if (itemsError) throw itemsError;
      const paths = (Array.isArray(items) ? items : [])
        .map((item) => String((item as { object_path?: unknown }).object_path || ""))
        .filter(Boolean);
      let cleanup = { queued: 0, removed: 0 };
      if (paths.length) {
        const storage = adminSupabase.storage.from(STORAGE_BUCKET);
        cleanup = await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: paths,
          ownerId: userId,
          reason: "upload_session_cancelled",
          storage,
        });
      }

      const { error: cancelSessionError } = await adminSupabase.rpc(
        "cancel_upload_session_records",
        {
          target_owner_id: userId,
          target_reason: "user_cancelled",
          target_session_id: sessionId,
        },
      );
      if (cancelSessionError) throw cancelSessionError;

      return c.json({ ...cleanup, sessionId });
    } catch (error) {
      if (error instanceof StorageRouteError) return c.json({ error: error.message }, error.status);
      if (error instanceof DiscoveryRouteValidationError)
        return c.json({ error: error.message }, error.status);
      logError("storage/upload-session/cancel", "upload-session-cancel-failed", error, {
        userId,
        sessionId,
      });
      return c.json({ error: "Upload session iptal edilemedi." }, 500);
    }
  });

  app.post("/make-server-e3557d40/storage/upload-session/sweep", async (c: EdgeRouteContext) => {
    let userId = "";
    try {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      userId = String(user.id || "").trim();
      const { error: expireError } = await adminSupabase.rpc("expire_stale_upload_sessions", {
        max_age: "24 hours",
      });
      if (expireError) throw expireError;

      const { data: items, error: itemsError } = await adminSupabase
        .from("upload_session_items")
        .select("object_path")
        .eq("owner_id", userId)
        .in("state", ["expired", "cancelled", "failed"]);
      if (itemsError) throw itemsError;
      const paths = (Array.isArray(items) ? items : [])
        .map((item) => String((item as { object_path?: unknown }).object_path || ""))
        .filter(Boolean);
      let cleanup = { queued: 0, removed: 0 };
      if (paths.length) {
        cleanup = await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: paths,
          ownerId: userId,
          reason: "upload_session_sweep",
          storage: adminSupabase.storage.from(STORAGE_BUCKET),
        });
      }
      const retries = await processOwnerCleanupJobs({ adminSupabase, userId });
      return c.json({ ...cleanup, retries });
    } catch (error) {
      logError("storage/upload-session/sweep", "upload-session-sweep-failed", error, { userId });
      return c.json({ error: "Upload temizlik isi tamamlanamadi." }, 500);
    }
  });
}
