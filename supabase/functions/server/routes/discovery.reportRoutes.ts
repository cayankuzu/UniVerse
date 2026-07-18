import { logError } from "../logging.ts";
import type { EdgeRouteContext, EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import {
  buildModerationReportSnapshots,
  sendModerationReportEmail,
  type ReportTargetInsertShape,
} from "../services/moderationReports.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import { createViewerSupabaseClient } from "../services/viewerSupabase.ts";
import {
  DiscoveryRouteValidationError,
  parseReportRequestBody,
} from "./discoveryRouteValidation.ts";
import type { DiscoveryRouteContext } from "./discoveryRouteContext.ts";

const REPORT_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const REPORT_RATE_LIMIT_MAX = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DiscoveryReportRouteDeps = Pick<ServerRouteDeps, "adminSupabase" | "getUser">;

function isUuid(value: string) {
  return UUID_PATTERN.test(String(value || "").trim());
}

async function resolveReportTarget(
  c: EdgeRouteContext,
  deps: DiscoveryReportRouteDeps,
  payload: ReturnType<typeof parseReportRequestBody>,
) {
  const viewerSupabase = createViewerSupabaseClient(c);
  if (!viewerSupabase) {
    throw new DiscoveryRouteValidationError("Yetkilendirme gerekli.", 401);
  }

  if (payload.targetType === "user") {
    const normalizedIdentifier = String(payload.targetUsername || payload.targetId || "")
      .trim()
      .toLowerCase();
    if (!normalizedIdentifier) {
      throw new DiscoveryRouteValidationError("Gecersiz sikayet hedefi", 400);
    }
    const targetQuery = isUuid(payload.targetId)
      ? deps.adminSupabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", payload.targetId)
          .maybeSingle()
      : deps.adminSupabase
          .from("profiles")
          .select("user_id")
          .eq("username", normalizedIdentifier)
          .maybeSingle();
    const { data, error } = await targetQuery;
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.user_id) {
      throw new DiscoveryRouteValidationError("Sikayet hedefi bulunamadi.", 404);
    }
    return {
      target_user_id: data.user_id,
      target_type: "user" as const,
    };
  }

  if (payload.targetType === "event") {
    const { data, error } = await viewerSupabase
      .from("events")
      .select("id")
      .eq("id", payload.targetId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.id) {
      throw new DiscoveryRouteValidationError("Sikayet hedefi bulunamadi.", 404);
    }
    return {
      target_event_id: data.id,
      target_type: "event" as const,
    };
  }

  if (payload.targetType === "album") {
    const { data, error } = await viewerSupabase
      .from("album_photos")
      .select("id")
      .eq("id", payload.targetId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.id) {
      throw new DiscoveryRouteValidationError("Sikayet hedefi bulunamadi.", 404);
    }
    return {
      target_photo_id: data.id,
      target_type: "album" as const,
    };
  }

  if (payload.targetType === "event_comment") {
    const { data, error } = await viewerSupabase
      .from("event_comments")
      .select("id")
      .eq("id", payload.targetId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.id) {
      throw new DiscoveryRouteValidationError("Sikayet hedefi bulunamadi.", 404);
    }
    return {
      target_event_comment_id: data.id,
      target_type: "event_comment" as const,
    };
  }

  const { data, error } = await viewerSupabase
    .from("album_photo_comments")
    .select("id")
    .eq("id", payload.targetId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new DiscoveryRouteValidationError("Sikayet hedefi bulunamadi.", 404);
  }
  return {
    target_album_comment_id: data.id,
    target_type: "album_comment" as const,
  };
}

export function registerDiscoveryReportRoutes(
  app: EdgeRouteApp,
  deps: DiscoveryReportRouteDeps,
  routeContext: DiscoveryRouteContext,
) {
  const { getUser } = deps;

  app.post("/make-server-e3557d40/reports", async (c: EdgeRouteContext) => {
    try {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const allowed = await routeContext.ensureRateLimitBudget(
        c,
        "reports:create",
        String(user.id || "").trim(),
        REPORT_RATE_LIMIT_MAX,
        REPORT_RATE_LIMIT_WINDOW_MS,
      );
      if (!allowed) {
        await recordSecurityAuditEvent({
          action: "report.create",
          adminSupabase: deps.adminSupabase,
          c,
          metadata: { reason: "budget_exhausted" },
          resourceType: "report",
          result: "rate_limited",
          userId: user.id,
        });
        await trackSecurityDetectionSignal({
          action: "report.create",
          adminSupabase: deps.adminSupabase,
          c,
          metadata: { reason: "budget_exhausted" },
          resourceType: "report",
          result: "rate_limited",
          severity: "high",
          signalType: "spam",
          threshold: 4,
          userId: user.id,
          windowMs: REPORT_RATE_LIMIT_WINDOW_MS,
        });
        return c.json(
          { error: "Sikayet gonderim limiti asildi. Lutfen daha sonra tekrar deneyin." },
          429,
        );
      }

      const body = parseReportRequestBody(await c.req.json().catch(() => ({})));
      const reportTarget = (await resolveReportTarget(c, deps, body)) as ReportTargetInsertShape;
      const viewerSupabase = createViewerSupabaseClient(c);
      if (!viewerSupabase) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const reportSnapshots = await buildModerationReportSnapshots({
        adminSupabase: deps.adminSupabase,
        reportTarget,
        reporterId: user.id,
        targetUsernameHint: body.targetUsername,
      });
      const { data: insertedReport, error } = await viewerSupabase
        .from("reports")
        .insert({
          detail: body.detail || null,
          mail_delivery_status: "pending",
          reason: body.reason,
          reporter_id: user.id,
          reporter_snapshot: reportSnapshots.reporterSnapshot,
          target_snapshot: reportSnapshots.targetSnapshot,
          ...reportTarget,
        })
        .select("id")
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      const reportId = String(insertedReport?.id || "").trim();
      if (reportId) {
        const mailDelivery = await sendModerationReportEmail({
          detail: body.detail || null,
          reason: body.reason,
          reportId,
          reporterSnapshot: reportSnapshots.reporterSnapshot,
          targetSnapshot: reportSnapshots.targetSnapshot,
          targetType: reportTarget.target_type,
        });
        const deliveryPatch = {
          mail_delivered_at: mailDelivery.status === "sent" ? new Date().toISOString() : null,
          mail_delivery_error: mailDelivery.errorMessage || null,
          mail_delivery_status: mailDelivery.status,
        };
        const { error: deliveryError } = await deps.adminSupabase
          .from("reports")
          .update(deliveryPatch)
          .eq("id", reportId);
        if (deliveryError) {
          logError("reports/create", "report-mail-delivery-status-update-failed", deliveryError, {
            reportId,
          });
        }
      }
      await recordSecurityAuditEvent({
        action: "report.create",
        adminSupabase: deps.adminSupabase,
        c,
        metadata: { targetType: reportTarget.target_type },
        resourceId: String(
          reportTarget.target_user_id ||
            reportTarget.target_event_id ||
            reportTarget.target_photo_id ||
            reportTarget.target_event_comment_id ||
            reportTarget.target_album_comment_id ||
            "",
        ),
        resourceType: reportTarget.target_type,
        result: "success",
        userId: user.id,
      });

      return c.json({ success: true });
    } catch (error) {
      if (error instanceof DiscoveryRouteValidationError) {
        return c.json({ error: error.message }, error.status);
      }
      await recordSecurityAuditEvent({
        action: "report.create",
        adminSupabase: deps.adminSupabase,
        c,
        resourceType: "report",
        result: "fail",
      });
      logError("reports/create", "report-submit-failed", error);
      return c.json({ error: "Sikayet gonderilemedi" }, 500);
    }
  });
}
