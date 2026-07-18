import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import {
  parseEmailVerificationBypassRequestBody,
  parseRegisterDirectRequestBody,
  parseRegisterRequestBody,
} from "./authRouteValidation.ts";
import type { EdgeRouteApp, EdgeRouteContext, KvProfileRecord, ServerRouteDeps } from "../types.ts";

type AuthRegistrationRouteDeps = Pick<
  ServerRouteDeps,
  | "USERNAME_REGEX"
  | "adminSupabase"
  | "getUser"
  | "normalizeEmail"
  | "normalizeUsername"
  | "persistProfile"
> & {
  allowTestVerificationBypassRoutes: boolean;
  buildAuthMetadata: (profile: KvProfileRecord | null) => Record<string, unknown>;
  consumeClientRateLimit: (
    c: EdgeRouteContext,
    scope: string,
    limit: number,
    windowMs: number,
  ) => Promise<boolean>;
  ensureDualRateLimitBudget: (params: {
    c: EdgeRouteContext;
    ipLimit: number;
    scope: string;
    userId: string;
    userLimit: number;
    windowMs: number;
  }) => Promise<boolean>;
  findAuthUserIdByEmail: (email: string) => Promise<string>;
  recoveryRateLimitWindowMs: number;
  registerRateLimitIpMax: number;
  registerRateLimitUserMax: number;
  registerRateLimitWindowMs: number;
  testVerificationBypassRateLimitMax: number;
  toRouteError: (error: unknown, fallbackMessage: string) => { message: string; status: number };
};

export function registerAuthRegistrationRoutes(app: EdgeRouteApp, deps: AuthRegistrationRouteDeps) {
  const {
    USERNAME_REGEX,
    adminSupabase,
    allowTestVerificationBypassRoutes,
    buildAuthMetadata,
    consumeClientRateLimit,
    ensureDualRateLimitBudget,
    findAuthUserIdByEmail,
    getUser,
    normalizeEmail,
    normalizeUsername,
    persistProfile,
    recoveryRateLimitWindowMs,
    registerRateLimitIpMax,
    registerRateLimitUserMax,
    registerRateLimitWindowMs,
    testVerificationBypassRateLimitMax,
    toRouteError,
  } = deps;

  app.post("/make-server-e3557d40/auth/register-direct", async (c) => {
    const registerAllowed = await consumeClientRateLimit(
      c,
      "auth:register-direct:ip",
      registerRateLimitIpMax,
      registerRateLimitWindowMs,
    );
    if (!registerAllowed) {
      await recordSecurityAuditEvent({
        action: "auth.register_direct",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
      });
      await trackSecurityDetectionSignal({
        action: "auth.register_direct",
        adminSupabase,
        c,
        metadata: { reason: "ip_budget_exhausted" },
        resourceType: "auth",
        result: "rate_limited",
        severity: "high",
        signalType: "spam",
        threshold: 4,
        windowMs: 15 * 60_000,
      });
      return c.json({ error: "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin." }, 429);
    }

    let createdUserId = "";
    let createdUsername = "";
    let createdEmail = "";
    try {
      const body = parseRegisterDirectRequestBody(await c.req.json().catch(() => ({})));
      const normalizedUsername = normalizeUsername(body.username || "");
      const normalizedEmail = normalizeEmail(body.email || "");
      const existingSignupUserId = String(body.existingUserId || "").trim();
      const registrationNonce = String(body.registrationNonce || "").trim();
      const usingExistingSignupUser = Boolean(existingSignupUserId && registrationNonce);
      let existingSignupUserMetadata: Record<string, unknown> = {};
      createdUsername = normalizedUsername;
      createdEmail = normalizedEmail;

      if (!normalizedEmail || !normalizedUsername) {
        return c.json({ error: "email ve username zorunludur" }, 400);
      }
      if (normalizedUsername.length < 3 || !USERNAME_REGEX.test(normalizedUsername)) {
        return c.json({ error: "Kullanici adi gecersiz" }, 400);
      }
      if (!usingExistingSignupUser) {
        return c.json({ error: "Kayit oturumu dogrulanamadi." }, 401);
      }

      const { data: existingSignupUserData, error: existingSignupUserError } =
        await adminSupabase.auth.admin.getUserById(existingSignupUserId);
      if (existingSignupUserError) {
        throw new Error(existingSignupUserError.message || "Kayit dogrulamasi basarisiz.");
      }

      const existingSignupUser = existingSignupUserData.user;
      if (!existingSignupUser?.id) {
        return c.json({ error: "Kayit kullanicisi bulunamadi." }, 404);
      }

      const existingSignupEmail = normalizeEmail(existingSignupUser.email || "");
      const existingSignupNonce = String(
        existingSignupUser.user_metadata?.registrationNonce ||
          existingSignupUser.user_metadata?.registration_nonce ||
          "",
      ).trim();
      if (!existingSignupNonce || existingSignupNonce !== registrationNonce) {
        return c.json({ error: "Kayit oturumu dogrulanamadi." }, 401);
      }
      if (existingSignupEmail !== normalizedEmail) {
        return c.json({ error: "Kayit e-posta bilgisi eslesmedi." }, 400);
      }

      existingSignupUserMetadata = existingSignupUser.user_metadata || {};
      createdUserId = existingSignupUser.id;

      const [
        { data: existingUsernameProfile, error: usernameProfileError },
        { data: existingEmailProfile, error: emailProfileError },
        existingUsernameId,
        existingEmailId,
      ] = await Promise.all([
        adminSupabase
          .from("profiles")
          .select("user_id")
          .eq("username", normalizedUsername)
          .maybeSingle(),
        adminSupabase.from("profiles").select("user_id").eq("email", normalizedEmail).maybeSingle(),
        kv.get<string>(`idx:username:${normalizedUsername}`),
        kv.get<string>(`idx:email:${normalizedEmail}`),
      ]);

      if (usernameProfileError) throw new Error(usernameProfileError.message);
      if (emailProfileError) throw new Error(emailProfileError.message);
      const existingUsernameOwnerId = String(
        existingUsernameProfile?.user_id || existingUsernameId || "",
      ).trim();
      const existingEmailOwnerId = String(
        existingEmailProfile?.user_id || existingEmailId || "",
      ).trim();
      if (existingUsernameOwnerId && existingUsernameOwnerId !== createdUserId) {
        return c.json({ error: "Bu kullanici adi zaten alinmis" }, 400);
      }
      if (existingEmailOwnerId && existingEmailOwnerId !== createdUserId) {
        return c.json({ error: "Bu e-posta adresi zaten kullaniliyor" }, 400);
      }

      if (!createdUserId) {
        return c.json({ error: "Kayit olusturulamadi." }, 400);
      }

      const persistedProfile = await persistProfile({
        userId: createdUserId,
        accountType: body.accountType,
        bio: body.bio,
        categories: body.categories,
        clubName: body.clubName,
        coverImage: body.coverImage,
        department: body.department,
        description: body.description,
        email: normalizedEmail,
        gradeYear: body.gradeYear,
        isPrivate: body.isPrivate,
        name: body.name,
        profileImage: body.profileImage,
        university: body.university,
        username: normalizedUsername,
      });

      const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(
        createdUserId,
        {
          user_metadata: {
            ...existingSignupUserMetadata,
            ...buildAuthMetadata(persistedProfile),
          },
        },
      );
      if (authUpdateError) {
        logError(
          "auth/register-direct",
          "register-direct-auth-metadata-sync-failed",
          authUpdateError,
          {
            userId: createdUserId,
          },
        );
      }
      await recordSecurityAuditEvent({
        action: "auth.register_direct",
        adminSupabase,
        c,
        metadata: {
          accountType: body.accountType,
          requiresEmailVerification: usingExistingSignupUser,
          sessionReady: false,
        },
        resourceId: createdUserId,
        resourceType: "profile",
        result: "success",
        userId: createdUserId,
      });
      await trackSecurityDetectionSignal({
        action: "auth.register_direct",
        adminSupabase,
        c,
        metadata: { accountType: body.accountType },
        resourceType: "auth",
        result: "success",
        severity: "high",
        signalType: "spam",
        threshold: 4,
        userId: createdUserId,
        windowMs: 60 * 60_000,
      });

      return c.json({
        success: true,
        userId: createdUserId,
        requiresEmailVerification: usingExistingSignupUser,
        sessionReady: false,
      });
    } catch (err) {
      if (createdUserId) {
        await adminSupabase
          .from("profiles")
          .delete()
          .eq("user_id", createdUserId)
          .catch(() => null);
        await kv.del(`profile:${createdUserId}`).catch(() => null);
        if (createdUsername) {
          await kv.del(`idx:username:${createdUsername}`).catch(() => null);
        }
        if (createdEmail) {
          await kv.del(`idx:email:${createdEmail}`).catch(() => null);
        }
      }
      const routeError = toRouteError(err, "Kayit hatasi");
      await recordSecurityAuditEvent({
        action: "auth.register_direct",
        adminSupabase,
        c,
        metadata: {
          status: routeError.status,
        },
        resourceId: createdUserId || createdEmail || null,
        resourceType: createdUserId ? "profile" : "auth",
        result: "fail",
        userId: createdUserId || null,
      });
      logError("auth/register-direct", "register-direct-failed", err, {
        userId: createdUserId || undefined,
      });
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  if (allowTestVerificationBypassRoutes) {
    app.post("/make-server-e3557d40/auth/test/confirm-email", async (c) => {
      const allowed = await consumeClientRateLimit(
        c,
        "auth:test-confirm-email:ip",
        testVerificationBypassRateLimitMax,
        recoveryRateLimitWindowMs,
      );
      if (!allowed) {
        return c.json({ error: "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin." }, 429);
      }

      try {
        const body = parseEmailVerificationBypassRequestBody(await c.req.json().catch(() => ({})));
        const normalizedEmail = normalizeEmail(body.email || "");
        const targetUserId = await findAuthUserIdByEmail(normalizedEmail);
        if (!targetUserId) {
          return c.json({ error: "Kullanici bulunamadi." }, 404);
        }

        const { error } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
          email_confirm: true,
        });
        if (error) {
          throw new Error(error.message || "E-posta onayi guncellenemedi.");
        }

        return c.json({ success: true, userId: targetUserId });
      } catch (error) {
        const routeError = toRouteError(error, "Test e-posta onayi guncellenemedi.");
        return c.json({ error: routeError.message }, routeError.status);
      }
    });
  }

  app.post("/make-server-e3557d40/auth/register", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const registerAllowed = await ensureDualRateLimitBudget({
      c,
      ipLimit: registerRateLimitIpMax,
      scope: "auth:register",
      userId: String(user.id || "").trim(),
      userLimit: registerRateLimitUserMax,
      windowMs: registerRateLimitWindowMs,
    });
    if (!registerAllowed) {
      await recordSecurityAuditEvent({
        action: "auth.register",
        adminSupabase,
        c,
        metadata: { reason: "dual_budget_exhausted" },
        resourceId: user.id,
        resourceType: "profile",
        result: "rate_limited",
        userId: user.id,
      });
      return c.json({ error: "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin." }, 429);
    }

    try {
      const body = parseRegisterRequestBody(await c.req.json().catch(() => ({})));
      const {
        email,
        username,
        accountType,
        name,
        clubName,
        university,
        department,
        gradeYear,
        bio,
        description,
        profileImage,
        coverImage,
        categories,
        isPrivate,
      } = body;
      const metadata = user.user_metadata || {};
      const normalizedUsername = normalizeUsername(
        username || metadata.username || metadata.userName || metadata.user_name || "",
      );
      const normalizedEmail = normalizeEmail(user.email || email || metadata.email || "");
      if (!normalizedEmail || !normalizedUsername) {
        return c.json({ error: "email ve username zorunludur" }, 400);
      }
      if (normalizedUsername.length < 3 || !USERNAME_REGEX.test(normalizedUsername)) {
        return c.json({ error: "Kullanici adi gecersiz" }, 400);
      }
      const [existingUsernameId, existingEmailId] = await Promise.all([
        kv.get<string>(`idx:username:${normalizedUsername}`),
        kv.get<string>(`idx:email:${normalizedEmail}`),
      ]);
      if (existingUsernameId && existingUsernameId !== user.id) {
        return c.json({ error: "Bu kullanici adi zaten alinmis" }, 400);
      }
      if (existingEmailId && existingEmailId !== user.id) {
        return c.json({ error: "Bu e-posta adresi zaten kullaniliyor" }, 400);
      }

      const persistedProfile = await persistProfile({
        userId: user.id,
        email: normalizedEmail,
        username: normalizedUsername,
        accountType: accountType || metadata.accountType || metadata.account_type,
        name: name || metadata.name || metadata.full_name,
        clubName: clubName || metadata.clubName || metadata.club_name,
        university: university || metadata.university,
        department,
        gradeYear,
        bio,
        description,
        profileImage,
        coverImage,
        categories,
        isPrivate,
      });

      const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: buildAuthMetadata(persistedProfile),
      });
      if (authUpdateError) {
        logError("auth/register", "register-auth-metadata-sync-failed", authUpdateError, {
          userId: user.id,
        });
      }
      await recordSecurityAuditEvent({
        action: "auth.register",
        adminSupabase,
        c,
        metadata: { accountType: persistedProfile.accountType },
        resourceId: user.id,
        resourceType: "profile",
        result: "success",
        userId: user.id,
      });

      return c.json({ success: true, userId: user.id });
    } catch (err) {
      const routeError = toRouteError(err, "Kayit hatasi");
      await recordSecurityAuditEvent({
        action: "auth.register",
        adminSupabase,
        c,
        metadata: { status: routeError.status },
        resourceId: user.id,
        resourceType: "profile",
        result: "fail",
        userId: user.id,
      });
      logError("auth/register", "register-or-profile-setup-failed", err, { userId: user.id });
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
