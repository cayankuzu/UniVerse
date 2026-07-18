import { logError } from "../logging.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import type { EdgeRouteApp, EdgeRouteContext, ServerRouteDeps } from "../types.ts";
import type { DiscoveryRouteContext } from "./discoveryRouteContext.ts";
import {
  DiscoveryRouteValidationError,
  parseSignedUrlRequestBody,
} from "./discoveryRouteValidation.ts";
import {
  assertSignedStoragePath,
  STORAGE_BUCKET,
  STORAGE_SIGNED_URL_TTL_SECONDS,
  StorageRouteError,
} from "./storagePolicy.ts";

const SIGNED_URL_BURST_WINDOW_MS = 60_000;
const SIGNED_URL_BURST_MAX = 120;
const SIGNED_URL_DAILY_WINDOW_MS = 24 * 60 * 60_000;
const SIGNED_URL_DAILY_MAX = 5_000;

type StorageSignedUrlRouteDeps = Pick<ServerRouteDeps, "adminSupabase" | "getUser">;

export function registerStorageSignedUrlRoute(
  app: EdgeRouteApp,
  deps: StorageSignedUrlRouteDeps,
  routeContext: DiscoveryRouteContext,
) {
  const { adminSupabase, getUser } = deps;

  app.post("/make-server-e3557d40/storage/signed-url", async (c: EdgeRouteContext) => {
    let userId = "";
    try {
      await routeContext.initStorageBucket();
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      userId = String(user.id || "").trim();
      const burstAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:signed-url:burst",
        userId,
        SIGNED_URL_BURST_MAX,
        SIGNED_URL_BURST_WINDOW_MS,
      );
      if (!burstAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.signed_url",
          adminSupabase,
          c,
          metadata: { reason: "burst_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        return c.json(
          { error: "Signed URL limiti asildi. Lutfen daha sonra tekrar deneyin." },
          429,
        );
      }
      const dailyAllowed = await routeContext.ensureRateLimitBudget(
        c,
        "storage:signed-url:daily",
        userId,
        SIGNED_URL_DAILY_MAX,
        SIGNED_URL_DAILY_WINDOW_MS,
      );
      if (!dailyAllowed) {
        await recordSecurityAuditEvent({
          action: "storage.signed_url",
          adminSupabase,
          c,
          metadata: { reason: "daily_budget_exhausted" },
          resourceType: "media_object",
          result: "rate_limited",
          userId,
        });
        return c.json({ error: "Gunluk signed URL limiti asildi." }, 429);
      }
      const { path } = parseSignedUrlRequestBody(await c.req.json().catch(() => ({})));
      const normalizedPath = assertSignedStoragePath(path).normalizedPath;
      const knownAsset = await routeContext.resolveKnownStorageOwner(normalizedPath);
      if (!knownAsset) {
        await recordSecurityAuditEvent({
          action: "storage.signed_url",
          adminSupabase,
          c,
          resourceId: normalizedPath,
          resourceType: "media_object",
          result: "denied",
          userId,
        });
        return c.json({ error: "Path kaydi bulunamadi" }, 404);
      }
      if (knownAsset.scanState !== "passed") {
        await recordSecurityAuditEvent({
          action: "storage.signed_url",
          adminSupabase,
          c,
          metadata: { reason: "media_scan_not_passed", scanState: knownAsset.scanState },
          resourceId: normalizedPath,
          resourceType: "media_object",
          result: "denied",
          userId,
        });
        return c.json({ error: "Medya guvenlik dogrulamasi tamamlanmadi." }, 423);
      }
      if (knownAsset.ownerId === user.id && knownAsset.source !== "media_assets") {
        await routeContext
          .upsertMediaAssetRecord({
            objectPath: normalizedPath,
            ownerId: user.id,
            scanState: "passed",
          })
          .catch(() => null);
      }
      const { data: canView, error: permissionError } = await adminSupabase.rpc(
        "can_view_media_object",
        {
          target_object_path: normalizedPath,
          viewer_id: user.id,
        },
      );
      if (permissionError) {
        logError("storage/signed-url", "signed-url-permission-check-failed", permissionError, {
          userId,
        });
        return c.json({ error: "URL olusturulamadi." }, 500);
      }
      if (!canView) {
        await recordSecurityAuditEvent({
          action: "storage.signed_url",
          adminSupabase,
          c,
          resourceId: normalizedPath,
          resourceType: "media_object",
          result: "denied",
          userId,
        });
        await trackSecurityDetectionSignal({
          action: "storage.signed_url",
          adminSupabase,
          c,
          resourceId: normalizedPath,
          resourceType: "media_object",
          result: "denied",
          severity: "medium",
          signalType: "repeated_access",
          threshold: 8,
          userId,
          windowMs: 5 * 60_000,
        });
        return c.json({ error: "Bu dosyaya erisemiyorsunuz." }, 403);
      }
      const { data, error: signedUrlError } = await adminSupabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(normalizedPath, STORAGE_SIGNED_URL_TTL_SECONDS);
      if (signedUrlError || !data?.signedUrl) {
        logError(
          "storage/signed-url",
          "signed-url-create-failed",
          signedUrlError || new Error("empty_signed_url"),
          { userId, normalizedPath },
        );
        return c.json({ error: "URL olusturulamadi." }, 500);
      }
      await recordSecurityAuditEvent({
        action: "storage.signed_url",
        adminSupabase,
        c,
        resourceId: normalizedPath,
        resourceType: "media_object",
        result: "success",
        userId,
      });
      return c.json({
        expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        url: data.signedUrl,
      });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "storage.signed_url",
        adminSupabase,
        c,
        metadata: { status: error instanceof StorageRouteError ? error.status : 500 },
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
      logError("storage/signed-url", "signed-url-failed", error, { userId });
      return c.json({ error: "URL olusturulamadi." }, 500);
    }
  });
}
