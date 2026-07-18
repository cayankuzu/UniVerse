import { isFunctionUnavailable, put } from "../../platform/api/core";
import { logError, startObservedTimer } from "../../platform/observability";
import { supabase } from "../../platform/supabase";
import { applyProfileUpdateInTable } from "./authProfileSync";
import type { UserProfile } from "../contracts/entities";
import { invalidateProfileReadCaches } from "../profile/profileLookup";
import {
  fallbackGetMeFromTable,
  getErrorMessage,
  isProfileLookupError,
  isUnauthorizedError,
  mergeProfiles,
  normalizeRemoteUserProfile,
  recoverLocalProfileFromAuthState,
  recoverSessionForProfileRead,
} from "./auth.shared";
import {
  syncCurrentAuthMetadata,
  syncCurrentAuthUser,
  throwGetMeFailure,
  type GetMeOptions,
} from "./auth.api.helpers";

const INVALID_SESSION_MESSAGE = "Oturum geçersiz. Lütfen tekrar giriş yap.";
const MISSING_PROFILE_MESSAGE = "Profil bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.";

export type PrivacyUpdateResponse = {
  isPrivate: boolean;
};

function canFallbackToLocalProfileSync(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    isFunctionUnavailable(error) ||
    isUnauthorizedError(error) ||
    message.includes("oturum geçersiz") ||
    message.includes("tekrar giriş")
  );
}

async function retryOwnProfileReadAfterSessionRecovery(
  readProfile: () => Promise<UserProfile>,
  recoverSessionOnUnauthorized: boolean,
): Promise<UserProfile | null> {
  if (!recoverSessionOnUnauthorized) return null;
  const recovered = await recoverSessionForProfileRead();
  if (!recovered) return null;
  try {
    return await readProfile();
  } catch {
    return null;
  }
}

function invalidateOwnProfileCaches(
  previousProfile: UserProfile | null,
  nextProfile: Pick<UserProfile, "id" | "username">,
) {
  invalidateProfileReadCaches({
    userId: nextProfile.id,
    usernames: [previousProfile?.username, nextProfile.username],
  });
}

function syncProfileMetadataBestEffort(profile: UserProfile) {
  void syncCurrentAuthMetadata(profile).catch((error) => {
    logError(error, {
      captureInSentry: false,
      meta: {
        operation: "sync-current-auth-metadata",
        scope: "auth-profile-sync",
      },
      name: "auth-profile-sync-non-blocking-error",
    });
  });
}

function syncProfileAuthUserBestEffort(
  previousProfile: UserProfile | null,
  nextProfile: UserProfile,
) {
  const previousEmail = String(previousProfile?.email || "")
    .trim()
    .toLowerCase();
  const nextEmail = String(nextProfile.email || "")
    .trim()
    .toLowerCase();
  void syncCurrentAuthUser(nextProfile, {
    includeEmail: Boolean(nextEmail && nextEmail !== previousEmail),
  }).catch((error) => {
    logError(error, {
      captureInSentry: false,
      meta: {
        operation: "sync-current-auth-user",
        scope: "auth-profile-sync",
      },
      name: "auth-profile-sync-non-blocking-error",
    });
  });
}

function finalizePrivacyUpdate(params: {
  currentProfile: UserProfile | null;
  nextIsPrivate: boolean;
  updatedProfile: UserProfile | null;
}) {
  if (!params.updatedProfile) {
    return { isPrivate: params.nextIsPrivate };
  }

  invalidateOwnProfileCaches(params.currentProfile, params.updatedProfile);
  syncProfileMetadataBestEffort(params.updatedProfile);
  return { isPrivate: params.nextIsPrivate };
}

export async function getMe(options: GetMeOptions = {}): Promise<UserProfile> {
  const recoverSessionOnUnauthorized = options.recoverSessionOnUnauthorized ?? true;
  const readProfile = () => fallbackGetMeFromTable({ includeMetrics: options.includeMetrics });

  try {
    return await readProfile();
  } catch (tableError) {
    if (isUnauthorizedError(tableError)) {
      const recoveredProfile = await retryOwnProfileReadAfterSessionRecovery(
        readProfile,
        recoverSessionOnUnauthorized,
      );
      if (recoveredProfile) return recoveredProfile;
      return throwGetMeFailure(INVALID_SESSION_MESSAGE, options);
    }

    if (!isProfileLookupError(tableError)) throw tableError;

    try {
      return await recoverLocalProfileFromAuthState();
    } catch (selfHealError) {
      if (isUnauthorizedError(selfHealError)) {
        const recoveredProfile = await retryOwnProfileReadAfterSessionRecovery(
          readProfile,
          recoverSessionOnUnauthorized,
        );
        if (recoveredProfile) return recoveredProfile;
        return throwGetMeFailure(INVALID_SESSION_MESSAGE, options);
      }
      if (!isProfileLookupError(selfHealError)) {
        throw selfHealError;
      }
    }

    return throwGetMeFailure(MISSING_PROFILE_MESSAGE, options);
  }
}

export async function updateProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  const stopProfileUpdateTelemetry = startObservedTimer({
    category: "mutation",
    meta: { target: "profile" },
    name: "update-profile",
  });
  const previousProfile = await fallbackGetMeFromTable().catch(() => null);

  try {
    const remoteUpdated = normalizeRemoteUserProfile(
      await put<UserProfile>("/auth/profile", payload, { authMode: "required" }),
    );
    const merged = previousProfile ? mergeProfiles(remoteUpdated, previousProfile) : remoteUpdated;
    invalidateOwnProfileCaches(previousProfile, merged);
    syncProfileMetadataBestEffort(merged);
    stopProfileUpdateTelemetry("ok", { source: "server" });
    return merged;
  } catch (error) {
    if (!canFallbackToLocalProfileSync(error)) throw error;

    const updated = await applyProfileUpdateInTable(payload, fallbackGetMeFromTable);
    invalidateOwnProfileCaches(previousProfile, updated);
    syncProfileAuthUserBestEffort(previousProfile, updated);
    stopProfileUpdateTelemetry(isFunctionUnavailable(error) ? "rollback" : "ok", {
      source: "table-plus-client-sync",
    });
    return updated;
  }
}

export async function updatePrivacy(isPrivate: boolean): Promise<PrivacyUpdateResponse> {
  const currentProfile = await fallbackGetMeFromTable().catch(() => null);
  const nextIsPrivate = currentProfile?.accountType === "club" ? false : isPrivate;

  try {
    const { error } = await supabase.rpc("update_profile_privacy_with_patch", {
      target_is_private: nextIsPrivate,
    });
    if (error) {
      throw new Error(error.message);
    }

    return finalizePrivacyUpdate({
      currentProfile,
      nextIsPrivate,
      updatedProfile: currentProfile ? { ...currentProfile, isPrivate: nextIsPrivate } : null,
    });
  } catch (error) {
    if (!canFallbackToLocalProfileSync(error)) throw error;
  }

  await put<{ isPrivate: boolean }>(
    "/auth/privacy",
    { isPrivate: nextIsPrivate },
    { authMode: "required" },
  );
  return finalizePrivacyUpdate({
    currentProfile,
    nextIsPrivate,
    updatedProfile: currentProfile ? { ...currentProfile, isPrivate: nextIsPrivate } : null,
  });
}
