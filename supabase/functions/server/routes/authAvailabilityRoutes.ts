import * as kv from "../kv_store.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import {
  parseEmailAvailabilityQuery,
  parseUsernameAvailabilityParams,
} from "./authRouteValidation.ts";
import type { EdgeRouteApp, EdgeRouteContext, ServerRouteDeps } from "../types.ts";

const AVAILABILITY_VALUE_LIMIT_MAX = 6;
const AVAILABILITY_VALUE_WINDOW_MS = 60_000;
const AVAILABILITY_RESPONSE_DELAY_BASE_MS = 180;
const AVAILABILITY_RESPONSE_DELAY_JITTER_MS = 120;

type AuthAvailabilityRouteDeps = Pick<ServerRouteDeps, "adminSupabase"> & {
  availabilityRateLimitReason: string;
  availabilityUnavailableReason: string;
  consumeRateLimit: (
    scope: string,
    subject: string,
    limit: number,
    windowMs: number,
  ) => Promise<boolean>;
  ensureAvailabilityBudget: (c: EdgeRouteContext, scope: string) => Promise<boolean>;
  findAuthUserIdByEmail: (email: string) => Promise<string>;
  toRouteError: (error: unknown, fallbackMessage: string) => { message: string; status: number };
};

function availabilityDelayMs() {
  const randomByte = crypto.getRandomValues(new Uint8Array(1))[0] || 0;
  return AVAILABILITY_RESPONSE_DELAY_BASE_MS + (randomByte % AVAILABILITY_RESPONSE_DELAY_JITTER_MS);
}

async function waitForNormalizedAvailabilityResponse() {
  await new Promise((resolve) => setTimeout(resolve, availabilityDelayMs()));
}

export function registerAuthAvailabilityRoutes(app: EdgeRouteApp, deps: AuthAvailabilityRouteDeps) {
  const {
    adminSupabase,
    availabilityRateLimitReason,
    availabilityUnavailableReason,
    consumeRateLimit,
    ensureAvailabilityBudget,
    findAuthUserIdByEmail,
    toRouteError,
  } = deps;

  app.get("/make-server-e3557d40/auth/check-username/:username", async (c) => {
    if (!(await ensureAvailabilityBudget(c, "check-username"))) {
      await recordSecurityAuditEvent({
        action: "auth.check_username",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
      });
      await trackSecurityDetectionSignal({
        action: "auth.check_username",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
        severity: "medium",
        signalType: "repeated_access",
        threshold: 8,
        windowMs: 5 * 60_000,
      });
      await waitForNormalizedAvailabilityResponse();
      return c.json({ available: false, reason: availabilityRateLimitReason }, 429);
    }

    try {
      const { username } = parseUsernameAvailabilityParams({
        username: c.req.param("username"),
      });
      const hasValueBudget = await consumeRateLimit(
        "auth:check-username:value",
        `username:${username}`,
        AVAILABILITY_VALUE_LIMIT_MAX,
        AVAILABILITY_VALUE_WINDOW_MS,
      );
      if (!hasValueBudget) {
        await recordSecurityAuditEvent({
          action: "auth.check_username",
          adminSupabase,
          c,
          metadata: { reason: "value_budget_exhausted" },
          resourceId: username,
          resourceType: "username",
          result: "rate_limited",
        });
        await trackSecurityDetectionSignal({
          action: "auth.check_username",
          adminSupabase,
          c,
          metadata: { reason: "value_budget_exhausted" },
          resourceId: username,
          resourceType: "username",
          result: "rate_limited",
          severity: "medium",
          signalType: "repeated_access",
          threshold: 6,
          windowMs: 60_000,
        });
        await waitForNormalizedAvailabilityResponse();
        return c.json({ available: false, reason: availabilityRateLimitReason }, 429);
      }

      const [{ data: existingProfile, error: profileError }, existingId] = await Promise.all([
        adminSupabase.from("profiles").select("user_id").eq("username", username).maybeSingle(),
        kv.get<string>(`idx:username:${username}`),
      ]);
      if (profileError) {
        throw new Error(profileError.message);
      }

      await waitForNormalizedAvailabilityResponse();
      if (existingProfile?.user_id || existingId) {
        return c.json({ available: false, reason: availabilityUnavailableReason });
      }
      return c.json({ available: true });
    } catch (error) {
      await waitForNormalizedAvailabilityResponse();
      const routeError = toRouteError(error, "Kullanici adi kontrol edilemedi.");
      return c.json({ available: false, reason: routeError.message }, routeError.status);
    }
  });

  app.get("/make-server-e3557d40/auth/check-email", async (c) => {
    if (!(await ensureAvailabilityBudget(c, "check-email"))) {
      await recordSecurityAuditEvent({
        action: "auth.check_email",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
      });
      await trackSecurityDetectionSignal({
        action: "auth.check_email",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
        severity: "medium",
        signalType: "repeated_access",
        threshold: 8,
        windowMs: 5 * 60_000,
      });
      await waitForNormalizedAvailabilityResponse();
      return c.json({ available: false, reason: availabilityRateLimitReason }, 429);
    }

    try {
      const { email: rawEmail } = parseEmailAvailabilityQuery({
        email: c.req.query("email"),
      });
      const hasValueBudget = await consumeRateLimit(
        "auth:check-email:value",
        `email:${rawEmail}`,
        AVAILABILITY_VALUE_LIMIT_MAX,
        AVAILABILITY_VALUE_WINDOW_MS,
      );
      if (!hasValueBudget) {
        await recordSecurityAuditEvent({
          action: "auth.check_email",
          adminSupabase,
          c,
          metadata: { reason: "value_budget_exhausted" },
          resourceId: rawEmail,
          resourceType: "email",
          result: "rate_limited",
        });
        await trackSecurityDetectionSignal({
          action: "auth.check_email",
          adminSupabase,
          c,
          metadata: { reason: "value_budget_exhausted" },
          resourceId: rawEmail,
          resourceType: "email",
          result: "rate_limited",
          severity: "high",
          signalType: "repeated_access",
          threshold: 6,
          windowMs: 60_000,
        });
        await waitForNormalizedAvailabilityResponse();
        return c.json({ available: false, reason: availabilityRateLimitReason }, 429);
      }

      const [{ data: existingProfile, error: profileError }, existingId, existingAuthUserId] =
        await Promise.all([
          adminSupabase.from("profiles").select("user_id").eq("email", rawEmail).maybeSingle(),
          kv.get<string>(`idx:email:${rawEmail}`),
          findAuthUserIdByEmail(rawEmail),
        ]);
      if (profileError) {
        throw new Error(profileError.message);
      }

      await waitForNormalizedAvailabilityResponse();
      if (existingProfile?.user_id || existingId || existingAuthUserId) {
        return c.json({ available: false, exists: true, reason: availabilityUnavailableReason });
      }
      return c.json({ available: true, exists: false });
    } catch (error) {
      await waitForNormalizedAvailabilityResponse();
      const routeError = toRouteError(error, "E-posta kontrol edilemedi.");
      return c.json({ available: false, reason: routeError.message }, routeError.status);
    }
  });
}
