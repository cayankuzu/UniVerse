import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import { recordSecurityAuditEvent } from "../services/securityAudit.ts";
import { createViewerSupabaseClient } from "../services/viewerSupabase.ts";
import {
  findProfileIdentityOwner,
  syncAuthProfileRecord,
  syncCanonicalProfileCache,
} from "../services/authProfileWrite.ts";
import {
  parsePrivacyRequestBody,
  parseProfileUpdateRequestBody,
  parseRepairRequestBody,
} from "./authRouteValidation.ts";
import { STORAGE_BUCKET } from "./storagePolicy.ts";
import type {
  EdgeRouteApp,
  EdgeRouteContext,
  EdgeUser,
  KvProfileRecord,
  ServerRouteDeps,
} from "../types.ts";

type ProfileCounts = {
  albumsCount: number;
  eventsCount: number;
  followersCount: number;
  followingCount: number;
};

type ProfileEnvelope = {
  counts: ProfileCounts;
  profile: KvProfileRecord;
  repair?: {
    repaired: boolean;
    skipped?: boolean;
    stats: Record<string, number>;
  };
};

type AuthProfileRouteDeps = Pick<
  ServerRouteDeps,
  | "USERNAME_REGEX"
  | "adminSupabase"
  | "buildUserDeletionContext"
  | "getUser"
  | "loadCanonicalProfile"
  | "migrateClubUsernameDependencies"
  | "normalizeEmail"
  | "normalizeUsername"
  | "purgeUserAccountData"
  | "syncClubEventProfileFields"
  | "syncProfileToTable"
> & {
  allowRecoveryRoutes: boolean;
  buildAuthMetadata: (profile: KvProfileRecord | null) => Record<string, unknown>;
  ensureDualRateLimitBudget: (params: {
    c: EdgeRouteContext;
    ipLimit: number;
    scope: string;
    userId: string;
    userLimit: number;
    windowMs: number;
  }) => Promise<boolean>;
  loadProfileEnvelope: (
    user: EdgeUser,
    options?: { allowRepair?: boolean; forceRepair?: boolean },
  ) => Promise<ProfileEnvelope | null>;
  mountPasswordFallback: boolean;
  recoveryRateLimitMax: number;
  recoveryRateLimitWindowMs: number;
  toRouteError: (error: unknown, fallbackMessage: string) => { message: string; status: number };
};

function buildProfileResponse(profile: KvProfileRecord, counts: Partial<ProfileCounts>) {
  return {
    ...profile,
    followingCount: Number(counts.followingCount || 0),
    followersCount: Number(counts.followersCount || 0),
    albumsCount: Number(counts.albumsCount || 0),
    eventsCount: Number(counts.eventsCount || 0),
  };
}

function collectStaleProfileMediaPaths(
  previousProfile: KvProfileRecord,
  nextProfile: KvProfileRecord,
) {
  const stalePaths = new Set<string>();
  const previousProfileImage = String(previousProfile.profileImage || "").trim();
  const previousCoverImage = String(previousProfile.coverImage || "").trim();
  const nextProfileImage = String(nextProfile.profileImage || "").trim();
  const nextCoverImage = String(nextProfile.coverImage || "").trim();

  if (previousProfileImage && previousProfileImage !== nextProfileImage) {
    stalePaths.add(previousProfileImage);
  }
  if (previousCoverImage && previousCoverImage !== nextCoverImage) {
    stalePaths.add(previousCoverImage);
  }

  return Array.from(stalePaths);
}

async function cleanupStaleProfileMedia(
  adminSupabase: AuthProfileRouteDeps["adminSupabase"],
  paths: string[],
) {
  if (paths.length === 0) return;
  await adminSupabase.storage
    .from(STORAGE_BUCKET)
    .remove(paths)
    .catch(() => null);
  const { error } = await adminSupabase.from("media_assets").delete().in("object_path", paths);
  if (error) {
    logError("auth/profile", "profile-media-cleanup-failed", error, {
      paths,
    });
  }
}

export function registerAuthProfileRoutes(app: EdgeRouteApp, deps: AuthProfileRouteDeps) {
  const {
    USERNAME_REGEX,
    adminSupabase,
    allowRecoveryRoutes,
    buildAuthMetadata,
    buildUserDeletionContext,
    ensureDualRateLimitBudget,
    getUser,
    loadCanonicalProfile,
    loadProfileEnvelope,
    migrateClubUsernameDependencies,
    mountPasswordFallback,
    normalizeEmail,
    normalizeUsername,
    purgeUserAccountData,
    recoveryRateLimitMax,
    recoveryRateLimitWindowMs,
    syncClubEventProfileFields,
    syncProfileToTable,
    toRouteError,
  } = deps;

  app.get("/make-server-e3557d40/auth/me", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const envelope = await loadProfileEnvelope(user, { allowRepair: allowRecoveryRoutes });
    if (!envelope?.profile) return c.json({ error: "Profile not found" }, 404);
    await recordSecurityAuditEvent({
      action: "auth.profile.read",
      adminSupabase,
      c,
      resourceId: user.id,
      resourceType: "profile",
      result: "success",
      userId: user.id,
    });

    return c.json(buildProfileResponse(envelope.profile, envelope.counts));
  });

  if (allowRecoveryRoutes) {
    app.post("/make-server-e3557d40/auth/materialize-profile", async (c) => {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const allowed = await ensureDualRateLimitBudget({
        c,
        ipLimit: recoveryRateLimitMax,
        scope: "auth:materialize-profile",
        userId: String(user.id || "").trim(),
        userLimit: recoveryRateLimitMax,
        windowMs: recoveryRateLimitWindowMs,
      });
      if (!allowed) {
        return c.json({ error: "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin." }, 429);
      }

      try {
        const envelope = await loadProfileEnvelope(user, { allowRepair: true });
        if (!envelope?.profile) return c.json({ error: "Profile not found" }, 404);
        return c.json(buildProfileResponse(envelope.profile, envelope.counts));
      } catch (error) {
        logError("auth/materialize-profile", "materialize-profile-failed", error, {
          userId: user.id,
        });
        return c.json({ error: "Profil hazirlanamadi." }, 500);
      }
    });

    app.post("/make-server-e3557d40/auth/repair-data", async (c) => {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const allowed = await ensureDualRateLimitBudget({
        c,
        ipLimit: recoveryRateLimitMax,
        scope: "auth:repair-data",
        userId: String(user.id || "").trim(),
        userLimit: recoveryRateLimitMax,
        windowMs: recoveryRateLimitWindowMs,
      });
      if (!allowed) {
        return c.json({ error: "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin." }, 429);
      }

      try {
        const body = parseRepairRequestBody(await c.req.json().catch(() => ({})));
        const envelope = await loadProfileEnvelope(user, {
          allowRepair: true,
          forceRepair: body.force,
        });
        if (!envelope?.profile) return c.json({ error: "Profile not found" }, 404);

        return c.json({
          repaired: Boolean(envelope.repair?.repaired),
          skipped: Boolean(envelope.repair?.skipped),
          stats: envelope.repair?.stats || {},
          profile: buildProfileResponse(envelope.profile, envelope.counts),
        });
      } catch (error) {
        const routeError = toRouteError(error, "Data repair failed");
        logError("auth/repair-data", "repair-data-failed", error, { userId: user.id });
        return c.json({ error: routeError.message }, routeError.status);
      }
    });
  }

  app.put("/make-server-e3557d40/auth/profile", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    let body;
    try {
      body = parseProfileUpdateRequestBody(await c.req.json().catch(() => ({})));
    } catch (error) {
      const routeError = toRouteError(error, "Profile update failed");
      return c.json({ error: routeError.message }, routeError.status);
    }
    const profile = await loadCanonicalProfile(user);
    if (!profile) return c.json({ error: "Profile not found" }, 404);
    const previousUsername = normalizeUsername(profile.username || "");
    const previousEmail = normalizeEmail(profile.email || "");

    let nextUsername = previousUsername;
    if (body.username !== undefined) {
      nextUsername = normalizeUsername(body.username || "");
      if (!nextUsername || nextUsername.length < 3 || !USERNAME_REGEX.test(nextUsername)) {
        return c.json({ error: "Kullanici adi gecersiz" }, 400);
      }
      if (nextUsername !== previousUsername) {
        const existing = await findProfileIdentityOwner({
          adminSupabase,
          field: "username",
          normalizeEmail,
          normalizeUsername,
          value: nextUsername,
        });
        if (existing && existing !== user.id) {
          return c.json({ error: "Bu kullanici adi zaten alinmis" }, 400);
        }
      }
    }

    let nextEmail = previousEmail;
    if (body.email !== undefined) {
      nextEmail = normalizeEmail(body.email || "");
      if (!nextEmail) return c.json({ error: "E-posta zorunludur" }, 400);
      if (nextEmail !== previousEmail) {
        const existingEmail = await findProfileIdentityOwner({
          adminSupabase,
          field: "email",
          normalizeEmail,
          normalizeUsername,
          value: nextEmail,
        });
        if (existingEmail && existingEmail !== user.id) {
          return c.json({ error: "Bu e-posta adresi zaten kullaniliyor" }, 400);
        }
      }
    }

    const updated = {
      ...profile,
      ...body,
      id: user.id,
      username: nextUsername,
      email: nextEmail,
    };
    const canonicalProfile = await syncProfileToTable(updated);
    const authSync = await syncAuthProfileRecord({
      adminSupabase,
      buildAuthMetadata,
      context: "auth/profile",
      nextProfile: canonicalProfile,
      previousEmail,
      userId: user.id,
    });
    if (authSync.fatal) {
      await syncProfileToTable(profile).catch((rollbackError) => {
        logError("auth/profile", "profile-sql-rollback-failed", rollbackError, { userId: user.id });
      });
      return c.json({ error: authSync.message || "Profil guncellenemedi." }, 400);
    }

    await syncCanonicalProfileCache({
      migrateClubUsernameDependencies,
      nextProfile: canonicalProfile,
      normalizeEmail,
      normalizeUsername,
      previousProfile: profile,
      syncClubEventProfileFields,
      userId: user.id,
    });
    await cleanupStaleProfileMedia(
      adminSupabase,
      collectStaleProfileMediaPaths(profile, canonicalProfile),
    );

    const envelope = await loadProfileEnvelope(user);
    const responseProfile = envelope?.profile || canonicalProfile;
    await recordSecurityAuditEvent({
      action: "auth.profile.update",
      adminSupabase,
      c,
      resourceId: user.id,
      resourceType: "profile",
      result: "success",
      userId: user.id,
    });
    return c.json(buildProfileResponse(responseProfile, envelope?.counts || {}));
  });

  app.put("/make-server-e3557d40/auth/privacy", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    let isPrivate;
    try {
      isPrivate = parsePrivacyRequestBody(await c.req.json().catch(() => ({}))).isPrivate;
    } catch (error) {
      const routeError = toRouteError(error, "Privacy update failed");
      return c.json({ error: routeError.message }, routeError.status);
    }
    const profile = await loadCanonicalProfile(user);
    if (!profile) return c.json({ error: "Profile not found" }, 404);
    const nextIsPrivate = profile.accountType === "club" ? false : isPrivate;
    const viewerSupabase = createViewerSupabaseClient(c);
    let canonicalProfile: KvProfileRecord | null = null;

    if (viewerSupabase) {
      const { error } = await viewerSupabase.rpc("update_profile_privacy", {
        target_is_private: nextIsPrivate,
      });
      if (error) {
        logError("auth/privacy", "update-profile-privacy-rpc-failed", error, {
          userId: user.id,
        });
      } else {
        canonicalProfile = await loadCanonicalProfile(user);
      }
    }

    if (!canonicalProfile) {
      canonicalProfile = await syncProfileToTable({
        ...profile,
        isPrivate: nextIsPrivate,
      });
    }

    await syncAuthProfileRecord({
      adminSupabase,
      buildAuthMetadata,
      context: "auth/privacy",
      nextProfile: canonicalProfile,
      previousEmail: profile.email,
      userId: user.id,
    });
    await kv.set(`profile:${user.id}`, canonicalProfile);
    await recordSecurityAuditEvent({
      action: "auth.privacy.update",
      adminSupabase,
      c,
      metadata: { isPrivate: canonicalProfile.isPrivate },
      resourceId: user.id,
      resourceType: "profile",
      result: "success",
      userId: user.id,
    });
    return c.json({ isPrivate: canonicalProfile.isPrivate });
  });

  if (mountPasswordFallback) {
    app.post("/make-server-e3557d40/auth/change-password", async (c) => {
      const user = await getUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      return c.json({ error: "Password change fallback disabled" }, 410);
    });
  }

  app.post("/make-server-e3557d40/auth/delete-account", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const deletionContext = await buildUserDeletionContext(user.id);
      await purgeUserAccountData(user.id, deletionContext);

      const { error } = await adminSupabase.auth.admin.deleteUser(user.id);
      if (error) {
        logError("auth/delete-account", "delete-user-auth-failed", error, { userId: user.id });
        return c.json({ error: "Hesap silinemedi." }, 400);
      }
      await recordSecurityAuditEvent({
        action: "auth.account.delete",
        adminSupabase,
        c,
        metadata: { source: "admin" },
        resourceId: user.id,
        resourceType: "profile",
        result: "success",
        userId: user.id,
      });
      return c.json({ success: true });
    } catch (error) {
      await recordSecurityAuditEvent({
        action: "auth.account.delete",
        adminSupabase,
        c,
        resourceId: user.id,
        resourceType: "profile",
        result: "fail",
        userId: user.id,
      });
      logError("auth/delete-account", "delete-account-failed", error, { userId: user.id });
      return c.json({ error: "Hesap silinemedi." }, 500);
    }
  });
}
