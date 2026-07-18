import { logError } from "../logging.ts";
import { recordSecurityAuditEvent } from "../services/securityAudit.ts";
import type { EdgeRouteApp, EdgeRouteContext, ServerRouteDeps } from "../types.ts";
import {
  DiscoveryRouteValidationError,
  parseSignedUploadConfirmRequestBody,
} from "./discoveryRouteValidation.ts";
import type { DiscoveryRouteContext } from "./discoveryRouteContext.ts";
import {
  assertSignedStoragePath,
  assertSignedUploadContentType,
  MAX_SIGNED_UPLOAD_BYTES,
  STORAGE_BUCKET,
  StorageRouteError,
} from "./storagePolicy.ts";
import { MediaScanError, triggerMediaScanHook } from "./storageMediaScan.ts";
import { removeStorageObjectsOrQueue } from "./storageCleanup.ts";

const STORAGE_UPLOAD_CONFIRM_RATE_LIMIT_WINDOW_MS = 60_000;
const STORAGE_UPLOAD_CONFIRM_RATE_LIMIT_MAX = 16;

type DiscoveryStorageUploadConfirmDeps = Pick<ServerRouteDeps, "adminSupabase" | "getUser">;

type StorageListClient = {
  list: (
    prefix: string,
    options: { limit: number; search: string },
  ) => Promise<{
    data: unknown[] | null;
    error: { message?: string } | null;
  }>;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function splitStorageObjectPath(objectPath: string) {
  const segments = objectPath.split("/").filter(Boolean);
  const fileName = normalizeText(segments.pop());
  return {
    fileName,
    prefix: segments.join("/"),
  };
}

function readStorageObjectSize(entry: Record<string, unknown> | null) {
  const metadata =
    entry?.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
  const candidates = [metadata.size, metadata.contentLength, metadata.content_length, entry?.size];
  for (const candidate of candidates) {
    const parsed = Number(candidate || 0);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
}

function readStorageObjectContentType(entry: Record<string, unknown> | null) {
  const metadata =
    entry?.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
  return normalizeText(
    metadata.mimetype || metadata.mimeType || metadata.contentType || metadata.content_type,
  ).toLowerCase();
}

async function resolveUploadedObjectMetadata(params: {
  objectPath: string;
  storage: StorageListClient;
}) {
  const { fileName, prefix } = splitStorageObjectPath(params.objectPath);
  if (!fileName || !prefix) {
    throw new StorageRouteError("Path gecersiz", 400);
  }
  const { data, error } = await params.storage.list(prefix, {
    limit: 100,
    search: fileName,
  });
  if (error) {
    throw new Error(error.message);
  }
  const entry = Array.isArray(data)
    ? (data.find((item) => normalizeText((item as Record<string, unknown>).name) === fileName) as
        Record<string, unknown> | undefined)
    : null;
  if (!entry) {
    throw new StorageRouteError("Yuklenen dosya bulunamadi", 404);
  }
  const sizeBytes = readStorageObjectSize(entry || null);
  if (!sizeBytes) {
    throw new StorageRouteError("Yuklenen dosya boyutu dogrulanamadi", 422);
  }
  return {
    contentType: readStorageObjectContentType(entry || null),
    sizeBytes,
  };
}

export function registerStorageUploadConfirmRoute(
  app: EdgeRouteApp,
  deps: DiscoveryStorageUploadConfirmDeps,
  routeContext: DiscoveryRouteContext,
) {
  const { adminSupabase, getUser } = deps;

  app.post("/make-server-e3557d40/storage/upload-confirm", async (c: EdgeRouteContext) => {
    let userId = "";
    let normalizedPath = "";
    try {
      await routeContext.initStorageBucket();
      const user = await getUser(c);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      userId = String(user.id || "").trim();
      const burstAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload-confirm:burst",
        userId,
        STORAGE_UPLOAD_CONFIRM_RATE_LIMIT_MAX,
        STORAGE_UPLOAD_CONFIRM_RATE_LIMIT_WINDOW_MS,
      );
      if (!burstAllowed) {
        return c.json(
          { error: "Upload dogrulama limiti asildi. Lutfen biraz sonra tekrar deneyin." },
          429,
        );
      }

      const requestBody = parseSignedUploadConfirmRequestBody(await c.req.json().catch(() => ({})));
      const requestedContentType = assertSignedUploadContentType(requestBody.contentType);
      const signedPath = assertSignedStoragePath(requestBody.path);
      normalizedPath = signedPath.normalizedPath;
      if (signedPath.ownerId !== userId) {
        await recordSecurityAuditEvent({
          action: "storage.upload_confirm",
          adminSupabase,
          c,
          resourceId: normalizedPath,
          resourceType: "media_object",
          result: "denied",
          userId,
        });
        return c.json({ error: "Bu dosyayi dogrulama yetkiniz yok." }, 403);
      }

      const storage = adminSupabase.storage.from(STORAGE_BUCKET);
      const metadata = await resolveUploadedObjectMetadata({
        objectPath: normalizedPath,
        storage,
      });
      if (metadata.sizeBytes > MAX_SIGNED_UPLOAD_BYTES) {
        await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: [normalizedPath],
          ownerId: userId,
          reason: "size_limit_rejected",
          storage,
        });
        throw new StorageRouteError("Dosya boyutu limiti asildi", 413);
      }
      const observedContentType = metadata.contentType
        ? assertSignedUploadContentType(metadata.contentType)
        : requestedContentType;
      if (observedContentType !== requestedContentType) {
        await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: [normalizedPath],
          ownerId: userId,
          reason: "content_type_rejected",
          storage,
        });
        throw new StorageRouteError("Dosya tipi ve upload kaydi eslesmiyor", 415);
      }

      const { data: sessionItem, error: sessionItemError } = await adminSupabase
        .from("upload_session_items")
        .select("session_id, expected_checksum, expected_content_type, expected_size_bytes")
        .eq("object_path", normalizedPath)
        .maybeSingle();
      if (sessionItemError) throw sessionItemError;
      if (sessionItem) {
        const expectedContentType = normalizeText(
          (sessionItem as { expected_content_type?: unknown }).expected_content_type,
        ).toLowerCase();
        const expectedSizeBytes = Number(
          (sessionItem as { expected_size_bytes?: unknown }).expected_size_bytes || 0,
        );
        if (expectedContentType && expectedContentType !== requestedContentType) {
          await removeStorageObjectsOrQueue({
            adminSupabase,
            objectPaths: [normalizedPath],
            ownerId: userId,
            reason: "session_content_type_rejected",
            storage,
          });
          throw new StorageRouteError("Dosya tipi upload session kaydi ile eslesmiyor", 415);
        }
        if (expectedSizeBytes > 0 && expectedSizeBytes !== metadata.sizeBytes) {
          await removeStorageObjectsOrQueue({
            adminSupabase,
            objectPaths: [normalizedPath],
            ownerId: userId,
            reason: "session_size_rejected",
            storage,
          });
          throw new StorageRouteError("Dosya boyutu upload session kaydi ile eslesmiyor", 413);
        }
      }

      await routeContext.upsertMediaAssetRecord({
        contentType: observedContentType,
        objectPath: normalizedPath,
        ownerId: userId,
        scanState: "pending",
        sizeBytes: metadata.sizeBytes,
      });
      const sessionId = sessionItem
        ? String((sessionItem as { session_id?: unknown }).session_id || "")
        : "";
      if (sessionItem) {
        const { error: quarantineItemError } = await adminSupabase
          .from("upload_session_items")
          .update({
            observed_content_type: observedContentType,
            observed_size_bytes: metadata.sizeBytes,
            scan_started_at: new Date().toISOString(),
            scan_state: "pending",
            state: "quarantined",
          })
          .eq("object_path", normalizedPath);
        if (quarantineItemError) throw quarantineItemError;
        if (sessionId) {
          const { error: quarantineSessionError } = await adminSupabase
            .from("upload_sessions")
            .update({ scan_started_at: new Date().toISOString(), state: "quarantined" })
            .eq("id", sessionId)
            .in("state", ["created", "uploading", "uploaded", "quarantined"]);
          if (quarantineSessionError) throw quarantineSessionError;
        }
      }
      const scanResult = await triggerMediaScanHook({
        contentType: observedContentType,
        objectPath: normalizedPath,
        ownerId: userId,
        sizeBytes: metadata.sizeBytes,
      });
      const scanContentType = scanResult.contentType
        ? assertSignedUploadContentType(scanResult.contentType)
        : observedContentType;
      const scanSizeBytes = scanResult.sizeBytes || metadata.sizeBytes;
      const expectedChecksum = normalizeText(
        (sessionItem as { expected_checksum?: unknown } | null)?.expected_checksum,
      ).toLowerCase();
      const contentTypeMatches = scanContentType === observedContentType;
      const sizeMatches = scanSizeBytes === metadata.sizeBytes;
      const checksumMatches =
        !expectedChecksum ||
        expectedChecksum === normalizeText(scanResult.checksumSha256).toLowerCase();
      const scanPassed =
        scanResult.verdict === "passed" && contentTypeMatches && sizeMatches && checksumMatches;
      const scanReason =
        scanResult.reason ||
        (!contentTypeMatches
          ? "content_type_mismatch"
          : !sizeMatches
            ? "size_mismatch"
            : !checksumMatches
              ? "checksum_mismatch"
              : scanPassed
                ? null
                : "media_scan_failed");
      const completedAt = new Date().toISOString();

      if (sessionId) {
        const { error: scanRecordError } = await adminSupabase.rpc("record_upload_scan_result", {
          target_object_path: normalizedPath,
          target_observed_checksum: scanResult.checksumSha256,
          target_observed_content_type: scanContentType,
          target_observed_size_bytes: scanSizeBytes,
          target_owner_id: userId,
          target_passed: scanPassed,
          target_scan_provider: scanResult.provider,
          target_scan_result: { ...scanResult.raw, reason: scanReason },
        });
        if (scanRecordError) throw scanRecordError;
      } else {
        await routeContext.upsertMediaAssetRecord({
          checksumSha256: scanResult.checksumSha256,
          contentType: scanContentType,
          objectPath: normalizedPath,
          ownerId: userId,
          scanCompletedAt: completedAt,
          scanProvider: scanResult.provider,
          scanState: scanPassed ? "passed" : "failed",
          sizeBytes: scanSizeBytes,
        });
      }
      if (!scanPassed) {
        await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: [normalizedPath],
          ownerId: userId,
          reason: String(scanReason || "media_scan_failed"),
          storage,
        });
        throw new StorageRouteError("Medya guvenlik dogrulamasindan gecemedi.", 422);
      }
      await recordSecurityAuditEvent({
        action: "storage.upload_confirm",
        adminSupabase,
        c,
        metadata: {
          contentType: observedContentType,
          scanProvider: scanResult.provider,
          sizeBytes: metadata.sizeBytes,
        },
        resourceId: normalizedPath,
        resourceType: "media_object",
        result: "success",
        userId,
      });
      return c.json({
        path: normalizedPath,
        sizeBytes: metadata.sizeBytes,
      });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "storage.upload_confirm",
        adminSupabase,
        c,
        metadata: {
          status:
            error instanceof StorageRouteError || error instanceof MediaScanError
              ? error.status
              : 500,
        },
        resourceId: normalizedPath || null,
        resourceType: "media_object",
        result: error instanceof StorageRouteError && error.status < 500 ? "denied" : "fail",
        userId: userId || null,
      });
      if (error instanceof StorageRouteError) {
        return c.json({ error: error.message }, error.status);
      }
      if (error instanceof DiscoveryRouteValidationError) {
        return c.json({ error: error.message }, error.status);
      }
      if (error instanceof MediaScanError) {
        logError("storage/upload-confirm", "media-scan-unavailable", error, { userId });
        return c.json({ error: error.message }, error.status);
      }
      logError("storage/upload-confirm", "storage-upload-confirm-failed", error, { userId });
      return c.json({ error: "Upload dogrulanamadi." }, 500);
    }
  });
}
