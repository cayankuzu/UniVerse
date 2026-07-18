import { createAuthRouteContext } from "../services/authRouteContext.ts";
import type { EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import { registerAuthAvailabilityRoutes } from "./authAvailabilityRoutes.ts";
import { registerAuthProfileRoutes } from "./authProfileRoutes.ts";
import { registerAuthRegistrationRoutes } from "./authRegistrationRoutes.ts";

export type AuthRouteOptions = {
  allowRecoveryRoutes?: boolean;
  allowTestVerificationBypassRoutes?: boolean;
  mountPasswordFallback?: boolean;
};

export function registerAuthRoutes(
  app: EdgeRouteApp,
  deps: ServerRouteDeps,
  options?: AuthRouteOptions,
) {
  const allowRecoveryRoutes = Boolean(options?.allowRecoveryRoutes);
  const allowTestVerificationBypassRoutes = Boolean(options?.allowTestVerificationBypassRoutes);
  const mountPasswordFallback = Boolean(options?.mountPasswordFallback);
  const authRouteContext = createAuthRouteContext({
    adminSupabase: deps.adminSupabase,
    loadCanonicalProfile: deps.loadCanonicalProfile,
    normalizeEmail: deps.normalizeEmail,
    normalizeUsername: deps.normalizeUsername,
    syncProfileToTable: deps.syncProfileToTable,
  });

  registerAuthAvailabilityRoutes(app, {
    adminSupabase: deps.adminSupabase,
    consumeRateLimit: authRouteContext.consumeRateLimit,
    availabilityRateLimitReason: authRouteContext.availabilityRateLimitReason,
    availabilityUnavailableReason: authRouteContext.availabilityUnavailableReason,
    ensureAvailabilityBudget: authRouteContext.ensureAvailabilityBudget,
    findAuthUserIdByEmail: authRouteContext.findAuthUserIdByEmail,
    toRouteError: authRouteContext.toRouteError,
  });

  registerAuthRegistrationRoutes(app, {
    USERNAME_REGEX: deps.USERNAME_REGEX,
    adminSupabase: deps.adminSupabase,
    allowTestVerificationBypassRoutes,
    buildAuthMetadata: authRouteContext.buildAuthMetadata,
    consumeClientRateLimit: authRouteContext.consumeClientRateLimit,
    ensureDualRateLimitBudget: authRouteContext.ensureDualRateLimitBudget,
    findAuthUserIdByEmail: authRouteContext.findAuthUserIdByEmail,
    getUser: deps.getUser,
    normalizeEmail: deps.normalizeEmail,
    normalizeUsername: deps.normalizeUsername,
    persistProfile: deps.persistProfile,
    recoveryRateLimitWindowMs: authRouteContext.recoveryRateLimitWindowMs,
    registerRateLimitIpMax: authRouteContext.registerRateLimitIpMax,
    registerRateLimitUserMax: authRouteContext.registerRateLimitUserMax,
    registerRateLimitWindowMs: authRouteContext.registerRateLimitWindowMs,
    testVerificationBypassRateLimitMax: authRouteContext.testVerificationBypassRateLimitMax,
    toRouteError: authRouteContext.toRouteError,
  });

  registerAuthProfileRoutes(app, {
    USERNAME_REGEX: deps.USERNAME_REGEX,
    adminSupabase: deps.adminSupabase,
    allowRecoveryRoutes,
    buildAuthMetadata: authRouteContext.buildAuthMetadata,
    buildUserDeletionContext: deps.buildUserDeletionContext,
    ensureDualRateLimitBudget: authRouteContext.ensureDualRateLimitBudget,
    getUser: deps.getUser,
    loadCanonicalProfile: deps.loadCanonicalProfile,
    loadProfileEnvelope: authRouteContext.loadProfileEnvelope,
    migrateClubUsernameDependencies: deps.migrateClubUsernameDependencies,
    mountPasswordFallback,
    normalizeEmail: deps.normalizeEmail,
    normalizeUsername: deps.normalizeUsername,
    purgeUserAccountData: deps.purgeUserAccountData,
    recoveryRateLimitMax: authRouteContext.recoveryRateLimitMax,
    recoveryRateLimitWindowMs: authRouteContext.recoveryRateLimitWindowMs,
    syncClubEventProfileFields: deps.syncClubEventProfileFields,
    syncProfileToTable: deps.syncProfileToTable,
    toRouteError: authRouteContext.toRouteError,
  });
}
