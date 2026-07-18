import * as kv from "../kv_store.ts";
import {
  consumeRateLimit as consumeSharedRateLimit,
  getRequestClientAddress,
} from "../rateLimit.ts";
import { repairCurrentUserReadModel } from "./authReadModelRepair.ts";
import { loadProfileCounts } from "./profileCounts.ts";
import type { EdgeRouteContext, EdgeUser, KvProfileRecord, ServerRouteDeps } from "../types.ts";
import { AuthRouteValidationError } from "../routes/authRouteValidation.ts";

const KV_TABLE = "kv_store_e3557d40";
const READ_MODEL_REPAIR_MARKER_KEY = "system:read-model-repair:v1";
const AVAILABILITY_UNAVAILABLE_REASON = "Bu deger su anda kullanilamiyor";
const AVAILABILITY_RATE_LIMIT_REASON = "Kontrol limiti asildi. Kisa bir sure sonra tekrar dene.";
const AVAILABILITY_RATE_LIMIT_MAX = 20;
const AVAILABILITY_RATE_LIMIT_WINDOW_MS = 60_000;
const REGISTER_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const REGISTER_RATE_LIMIT_IP_MAX = 5;
const REGISTER_RATE_LIMIT_USER_MAX = 3;
const RECOVERY_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const RECOVERY_RATE_LIMIT_MAX = 3;
const TEST_VERIFICATION_BYPASS_RATE_LIMIT_MAX = 10;

type AuthContextDeps = Pick<
  ServerRouteDeps,
  | "adminSupabase"
  | "loadCanonicalProfile"
  | "normalizeEmail"
  | "normalizeUsername"
  | "syncProfileToTable"
>;

export function createAuthRouteContext(deps: AuthContextDeps) {
  const {
    adminSupabase,
    loadCanonicalProfile,
    normalizeEmail,
    normalizeUsername,
    syncProfileToTable,
  } = deps;
  const repairCurrentUserData = (user: EdgeUser) =>
    repairCurrentUserReadModel({
      adminSupabase,
      kvTable: KV_TABLE,
      normalizeEmail,
      normalizeUsername,
      syncProfileToTable,
      user,
    });

  const sumProfileCounts = (counts: {
    followingCount: number;
    followersCount: number;
    albumsCount: number;
    eventsCount: number;
  }) =>
    Number(counts.followingCount || 0) +
    Number(counts.followersCount || 0) +
    Number(counts.albumsCount || 0) +
    Number(counts.eventsCount || 0);

  const loadProfileEnvelope = async (
    user: EdgeUser,
    options?: {
      allowRepair?: boolean;
      forceRepair?: boolean;
    },
  ) => {
    const allowRepair = Boolean(options?.allowRepair);
    const forceRepair = Boolean(options?.forceRepair);
    const viewerId = String(user?.id || "").trim();
    if (!viewerId) return null;

    let profile = await loadCanonicalProfile(user);
    if (!profile) return null;

    let counts = await loadProfileCounts(adminSupabase, viewerId, profile.accountType);
    let repairMeta: {
      repaired: boolean;
      skipped?: boolean;
      stats: Record<string, number>;
    } = {
      repaired: false,
      skipped: false,
      stats: {},
    };

    const shouldAttemptRepair = forceRepair || (allowRepair && sumProfileCounts(counts) === 0);
    if (shouldAttemptRepair) {
      const userRepairKey = `repair:user:${viewerId}:v1`;
      const [globalRepairMarker, userRepairMarker] = await Promise.all([
        kv.get<string>(READ_MODEL_REPAIR_MARKER_KEY),
        kv.get<string>(userRepairKey),
      ]);

      if (forceRepair || !globalRepairMarker || !userRepairMarker) {
        repairMeta = await repairCurrentUserData(user);
        const repairedAt = new Date().toISOString();
        await kv.mset([
          { key: READ_MODEL_REPAIR_MARKER_KEY, value: globalRepairMarker || repairedAt },
          { key: userRepairKey, value: repairedAt },
        ]);

        profile = await loadCanonicalProfile(user);
        if (!profile) return null;
        counts = await loadProfileCounts(adminSupabase, viewerId, profile.accountType);
      } else {
        repairMeta = {
          repaired: false,
          skipped: true,
          stats: {},
        };
      }
    }

    return {
      counts,
      profile,
      repair: repairMeta,
    };
  };

  const buildAuthMetadata = (profile: KvProfileRecord | null) => ({
    ...(profile?.accountType === "club"
      ? { isPrivate: false, is_private: false }
      : { isPrivate: Boolean(profile?.isPrivate), is_private: Boolean(profile?.isPrivate) }),
    accountType: profile?.accountType || "student",
    account_type: profile?.accountType || "student",
    username: profile?.username || "",
    email: profile?.email || "",
    university: profile?.university || "",
    department: profile?.department || "",
    gradeYear: profile?.gradeYear || "",
    grade_year: profile?.gradeYear || "",
    bio: profile?.bio || "",
    description: profile?.description || "",
    profileImage: profile?.profileImage || "",
    coverImage: profile?.coverImage || "",
    categories: Array.isArray(profile?.categories) ? profile.categories : [],
    hideEmail: Boolean(profile?.hideEmail),
    hide_email: Boolean(profile?.hideEmail),
    name: profile?.name || "",
    clubName: profile?.clubName || "",
    club_name: profile?.clubName || "",
  });

  const consumeRateLimit = async (
    scope: string,
    subject: string,
    limit: number,
    windowMs: number,
  ) => {
    return consumeSharedRateLimit({
      scope,
      subject,
      limit,
      windowMs,
    });
  };

  const ensureAvailabilityBudget = async (c: EdgeRouteContext, scope: string) =>
    consumeRateLimit(
      `auth:${scope}`,
      getRequestClientAddress(c),
      AVAILABILITY_RATE_LIMIT_MAX,
      AVAILABILITY_RATE_LIMIT_WINDOW_MS,
    );

  const consumeClientRateLimit = (
    c: EdgeRouteContext,
    scope: string,
    limit: number,
    windowMs: number,
  ) => consumeRateLimit(scope, getRequestClientAddress(c), limit, windowMs);

  const ensureDualRateLimitBudget = async (params: {
    c: EdgeRouteContext;
    ipLimit: number;
    scope: string;
    userId: string;
    userLimit: number;
    windowMs: number;
  }) => {
    const ipAddress = getRequestClientAddress(params.c);
    const [ipAllowed, userAllowed] = await Promise.all([
      consumeRateLimit(`${params.scope}:ip`, ipAddress, params.ipLimit, params.windowMs),
      consumeRateLimit(`${params.scope}:user`, params.userId, params.userLimit, params.windowMs),
    ]);
    return ipAllowed && userAllowed;
  };

  const toRouteError = (error: unknown, fallbackMessage: string) => {
    if (error instanceof AuthRouteValidationError) {
      return {
        message: error.message,
        status: error.status,
      };
    }
    const rawMessage = String((error as { message?: string })?.message || error || "");
    const lowered = rawMessage.toLowerCase();
    if (lowered.includes("unauthorized")) {
      return { message: "Yetki dogrulanamadi.", status: 401 };
    }
    if (lowered.includes("not found")) {
      return { message: "Kaynak bulunamadi.", status: 404 };
    }
    return {
      message: fallbackMessage,
      status: 500,
    };
  };

  const findAuthUserIdByEmail = async (email: string) => {
    const normalizedTargetEmail = normalizeEmail(email || "");
    if (!normalizedTargetEmail) return "";

    const { data: existingProfile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("user_id")
      .eq("email", normalizedTargetEmail)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (existingProfile?.user_id) return String(existingProfile.user_id).trim();

    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const users = Array.isArray(data?.users) ? data.users : [];
      const matchedUser = users.find(
        (item) => normalizeEmail(item.email || "") === normalizedTargetEmail,
      );
      if (matchedUser?.id) return String(matchedUser.id).trim();
      if (users.length < perPage) break;
      page += 1;
    }

    return "";
  };

  return {
    availabilityRateLimitReason: AVAILABILITY_RATE_LIMIT_REASON,
    availabilityUnavailableReason: AVAILABILITY_UNAVAILABLE_REASON,
    buildAuthMetadata,
    consumeRateLimit,
    consumeClientRateLimit,
    ensureAvailabilityBudget,
    ensureDualRateLimitBudget,
    findAuthUserIdByEmail,
    loadProfileEnvelope,
    recoveryRateLimitMax: RECOVERY_RATE_LIMIT_MAX,
    recoveryRateLimitWindowMs: RECOVERY_RATE_LIMIT_WINDOW_MS,
    registerRateLimitIpMax: REGISTER_RATE_LIMIT_IP_MAX,
    registerRateLimitUserMax: REGISTER_RATE_LIMIT_USER_MAX,
    registerRateLimitWindowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
    testVerificationBypassRateLimitMax: TEST_VERIFICATION_BYPASS_RATE_LIMIT_MAX,
    toRouteError,
  };
}
