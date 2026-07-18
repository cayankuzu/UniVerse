import { logError } from "../logging.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import type { EdgeRouteContext, EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import {
  buildSignedUploadObjectPath,
  parseStorageUploadForm,
  STORAGE_BUCKET,
  STORAGE_SIGNED_URL_TTL_SECONDS,
  StorageRouteError,
} from "./storagePolicy.ts";
import {
  DiscoveryRouteValidationError,
  parseSignedUploadTicketRequestBody,
} from "./discoveryRouteValidation.ts";
import type { DiscoveryRouteContext } from "./discoveryRouteContext.ts";
import { registerStorageUploadConfirmRoute } from "./discovery.storageUploadConfirmRoute.ts";
import { registerStorageUploadSessionRoutes } from "./discovery.storageUploadSessionRoutes.ts";
import { registerStorageSignedUrlRoute } from "./discovery.storageSignedUrlRoute.ts";
import { MediaScanError, triggerMediaScanHook } from "./storageMediaScan.ts";
import { removeStorageObjectsOrQueue } from "./storageCleanup.ts";

const STORAGE_UPLOAD_RATE_LIMIT_WINDOW_MS = 60_000;
const STORAGE_UPLOAD_RATE_LIMIT_MAX = 8;
const STORAGE_UPLOAD_DAILY_LIMIT_WINDOW_MS = 24 * 60 * 60_000;
const STORAGE_UPLOAD_DAILY_LIMIT_MAX = 96;

type DiscoveryStorageRouteDeps = Pick<ServerRouteDeps, "adminSupabase" | "getUser">;

export function registerDiscoveryStorageRoutes(
  app: EdgeRouteApp,
  deps: DiscoveryStorageRouteDeps,
  routeContext: DiscoveryRouteContext,
) {
  const { adminSupabase, getUser } = deps;

  void routeContext.initStorageBucket();

  app.post("/make-server-e3557d40/storage/upload-ticket", async (c: EdgeRouteContext) => {
    let userId = "";
    try {
      await routeContext.initStorageBucket();
      const user = await getUser(c);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      userId = String(user.id || "").trim();
      const burstAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload-ticket:burst",
        userId,
        STORAGE_UPLOAD_RATE_LIMIT_MAX,
        STORAGE_UPLOAD_RATE_LIMIT_WINDOW_MS,
      );
      if (!burstAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.upload_ticket",
          adminSupabase,
          c,
          metadata: { reason: "burst_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        return c.json({ error: "Upload limiti asildi. Lutfen biraz sonra tekrar deneyin." }, 429);
      }
      const dailyAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload-ticket:daily",
        userId,
        STORAGE_UPLOAD_DAILY_LIMIT_MAX,
        STORAGE_UPLOAD_DAILY_LIMIT_WINDOW_MS,
      );
      if (!dailyAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.upload_ticket",
          adminSupabase,
          c,
          metadata: { reason: "daily_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        return c.json({ error: "Gunluk upload limiti asildi." }, 429);
      }

      const requestBody = parseSignedUploadTicketRequestBody(await c.req.json().catch(() => ({})));
      const uploadTarget = buildSignedUploadObjectPath({
        contentType: requestBody.contentType,
        folder: requestBody.folder,
        sourceName: requestBody.sourceName,
        uploadKey: requestBody.uploadKey,
        userId: user.id,
      });
      const signedUpload = await adminSupabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(uploadTarget.objectPath, {
          upsert: Boolean(uploadTarget.uploadKey),
        });
      if (signedUpload.error || !signedUpload.data?.signedUrl) {
        logError(
          "storage/upload-ticket",
          "storage-upload-ticket-create-failed",
          signedUpload.error || new Error("empty_signed_upload_url"),
          { userId },
        );
        return c.json({ error: "Upload URL olusturulamadi." }, 500);
      }

      await recordSecurityAuditEvent({
        action: "storage.upload_ticket",
        adminSupabase,
        c,
        metadata: {
          contentType: uploadTarget.contentType,
          folder: uploadTarget.folder,
        },
        resourceId: uploadTarget.objectPath,
        resourceType: "media_object",
        result: "success",
        userId,
      });

      return c.json({
        path: uploadTarget.objectPath,
        uploadUrl: signedUpload.data.signedUrl,
      });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "storage.upload_ticket",
        adminSupabase,
        c,
        metadata: {
          status: error instanceof StorageRouteError ? error.status : 500,
        },
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
      logError("storage/upload-ticket", "storage-upload-ticket-failed", error, { userId });
      return c.json({ error: "Upload URL olusturulamadi." }, 500);
    }
  });

  registerStorageUploadConfirmRoute(app, deps, routeContext);
  registerStorageUploadSessionRoutes(app, deps, routeContext);

  app.post("/make-server-e3557d40/storage/upload", async (c: EdgeRouteContext) => {
    let userId = "";
    try {
      await routeContext.initStorageBucket();
      const user = await getUser(c);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      userId = String(user.id || "").trim();
      const burstAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload:burst",
        userId,
        STORAGE_UPLOAD_RATE_LIMIT_MAX,
        STORAGE_UPLOAD_RATE_LIMIT_WINDOW_MS,
      );
      if (!burstAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.upload",
          adminSupabase,
          c,
          metadata: { reason: "burst_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        return c.json({ error: "Upload limiti asildi. Lutfen biraz sonra tekrar deneyin." }, 429);
      }
      const dailyAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:upload:daily",
        userId,
        STORAGE_UPLOAD_DAILY_LIMIT_MAX,
        STORAGE_UPLOAD_DAILY_LIMIT_WINDOW_MS,
      );
      if (!dailyAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.upload",
          adminSupabase,
          c,
          metadata: { reason: "daily_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        await trackSecurityDetectionSignal({
          action: "storage.upload",
          adminSupabase,
          c,
          metadata: { reason: "daily_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          severity: "high",
          signalType: "spam",
          threshold: 4,
          userId,
          windowMs: STORAGE_UPLOAD_DAILY_LIMIT_WINDOW_MS,
        });
        return c.json({ error: "Gunluk upload limiti asildi." }, 429);
      }
      const formData = await c.req.formData();
      const upload = await parseStorageUploadForm(formData, user.id);

      const storage = adminSupabase.storage.from(STORAGE_BUCKET);
      const { error } = await storage.upload(upload.objectPath, upload.arrayBuffer, {
        contentType: upload.contentType,
        upsert: Boolean(upload.uploadKey),
      });

      if (error) {
        logError("storage/upload", "storage-upload-provider-failed", error, { userId });
        return c.json({ error: "Dosya yuklenemedi." }, 500);
      }

      try {
        await routeContext.upsertMediaAssetRecord({
          contentType: upload.contentType,
          objectPath: upload.objectPath,
          ownerId: user.id,
          scanState: "pending",
          sizeBytes: upload.sizeBytes,
        });
      } catch (registryError) {
        await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: [upload.objectPath],
          ownerId: user.id,
          reason: "media_registry_failed",
          storage,
        });
        throw registryError;
      }

      const scanResult = await triggerMediaScanHook({
        contentType: upload.contentType,
        objectPath: upload.objectPath,
        ownerId: user.id,
        sizeBytes: upload.sizeBytes,
      });
      const scanPassed =
        scanResult.verdict === "passed" &&
        scanResult.contentType === upload.contentType &&
        scanResult.sizeBytes === upload.sizeBytes &&
        Boolean(scanResult.checksumSha256);
      await routeContext.upsertMediaAssetRecord({
        checksumSha256: scanResult.checksumSha256,
        contentType: scanResult.contentType || upload.contentType,
        objectPath: upload.objectPath,
        ownerId: user.id,
        scanCompletedAt: new Date().toISOString(),
        scanProvider: scanResult.provider,
        scanState: scanPassed ? "passed" : "failed",
        sizeBytes: scanResult.sizeBytes || upload.sizeBytes,
      });
      if (!scanPassed) {
        await removeStorageObjectsOrQueue({
          adminSupabase,
          objectPaths: [upload.objectPath],
          ownerId: user.id,
          reason: String(scanResult.reason || "media_scan_failed"),
          storage,
        });
        throw new StorageRouteError("Medya guvenlik dogrulamasindan gecemedi.", 422);
      }

      const { data: signedUrlData, error: signedUrlError } = await storage.createSignedUrl(
        upload.objectPath,
        STORAGE_SIGNED_URL_TTL_SECONDS,
      );
      if (signedUrlError) {
        logError("storage/upload", "storage-upload-signed-url-failed", signedUrlError, { userId });
      }
      await recordSecurityAuditEvent({
        action: "storage.upload",
        adminSupabase,
        c,
        metadata: {
          contentType: upload.contentType,
          folder: upload.folder,
          sizeBytes: upload.sizeBytes,
        },
        resourceId: upload.objectPath,
        resourceType: "media_object",
        result: "success",
        userId,
      });
      await trackSecurityDetectionSignal({
        action: "storage.upload",
        adminSupabase,
        c,
        metadata: { folder: upload.folder, sizeBytes: upload.sizeBytes },
        resourceId: upload.folder,
        resourceType: "media_bucket_folder",
        result: "success",
        severity: "high",
        signalType: "spam",
        threshold: 10,
        userId,
        windowMs: 15 * 60_000,
      });

      return c.json({
        expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        path: upload.objectPath,
        url: signedUrlData?.signedUrl || "",
      });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "storage.upload",
        adminSupabase,
        c,
        metadata: {
          status:
            error instanceof StorageRouteError || error instanceof MediaScanError
              ? error.status
              : 500,
        },
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
        logError("storage/upload", "media-scan-unavailable", error, { userId });
        return c.json({ error: error.message }, error.status);
      }
      logError("storage/upload", "storage-upload-failed", error, { userId });
      return c.json({ error: "Dosya yuklenemedi." }, 500);
    }
  });

  registerStorageSignedUrlRoute(app, deps, routeContext);
}
