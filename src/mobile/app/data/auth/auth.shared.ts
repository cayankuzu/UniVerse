import { supabase } from "../../platform/supabase";
import type { AccountType, SuccessResponse } from "../contracts/api";
import type { UserProfile } from "../contracts/entities";
import { ensureCurrentUserProfileRow } from "./authProfileSync";
import { loadProfileMetrics } from "../profile/profileMetrics";
import { getCurrentAuthUserOrThrow } from "./authSession.shared";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";
import {
  buildFallbackProfileFromCurrentUser as buildFallbackProfileFromCurrentUserInternal,
  mapDbProfileToUserProfile as mapDbProfileToUserProfileInternal,
  PROFILE_TABLE_SELECT_COLUMNS as PROFILE_TABLE_SELECT_COLUMNS_INTERNAL,
} from "./auth.shared.profile";

export { getErrorMessage, isProfileLookupError, isUnauthorizedError } from "./auth.shared.errors";
export {
  buildFallbackProfileFromCurrentUser,
  mapDbProfileToUserProfile,
  mergeProfiles,
  normalizeFollowRequestItem,
  normalizeRemoteUserProfile,
  PROFILE_TABLE_SELECT_COLUMNS,
  scoreProfileCompleteness,
} from "./auth.shared.profile";

export interface RegisterPayload {
  userId: string;
  email: string;
  username: string;
  accountType: AccountType;
  name?: string;
  clubName?: string;
  university: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
  profileImage?: string;
  coverImage?: string;
  categories: string[];
  isPrivate: boolean;
}

export interface RegisterDirectPayload {
  email: string;
  username: string;
  password: string;
  accountType: AccountType;
  name?: string;
  clubName?: string;
  university: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
  profileImage?: string;
  coverImage?: string;
  categories: string[];
  isPrivate: boolean;
}

export interface RegisterResponse {
  success: boolean;
  userId: string;
  requiresEmailVerification?: boolean;
  sessionReady?: boolean;
}

type FallbackGetMeOptions = {
  includeMetrics?: boolean;
};

export async function recoverSessionForProfileRead(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return false;
    return Boolean(data.session?.access_token);
  } catch {
    return false;
  }
}

export async function recoverLocalProfileFromAuthState(): Promise<UserProfile> {
  const fallbackProfile = await buildFallbackProfileFromCurrentUserInternal();
  try {
    await ensureCurrentUserProfileRow(fallbackProfile);
    return await fallbackGetMeFromTable();
  } catch {
    try {
      await upsertProfileToTable(fallbackProfile);
      return await fallbackGetMeFromTable();
    } catch {
      return fallbackProfile;
    }
  }
}

export async function upsertProfileToTable(profile: UserProfile): Promise<void> {
  const isPrivate = resolveProfilePrivacy(profile.accountType, profile.isPrivate);
  const payload: Record<string, string | string[] | boolean | null> = {
    user_id: profile.id,
    username: profile.username.trim().toLowerCase(),
    account_type: profile.accountType,
    email: profile.email.trim().toLowerCase(),
    university: profile.university || "Belirtilmedi",
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    is_private: isPrivate,
    hide_email: Boolean(profile.hideEmail),
    profile_image_path: profile.profileImage || null,
    cover_image_path: profile.coverImage || null,
    department: profile.department || null,
    grade_year: profile.gradeYear || null,
    bio: profile.bio || null,
    description: profile.description || null,
    name: profile.accountType === "student" ? profile.name || null : null,
    club_name: profile.accountType === "club" ? profile.clubName || null : null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function fallbackGetMeFromTable(
  options: FallbackGetMeOptions = {},
): Promise<UserProfile> {
  const user = await getCurrentAuthUserOrThrow();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_TABLE_SELECT_COLUMNS_INTERNAL)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Profile not found");

  const metrics =
    options.includeMetrics === false
      ? {
          albumsCount: 0,
          eventsCount: 0,
          followersCount: 0,
          followingCount: 0,
        }
      : await loadProfileMetrics(user.id);
  return mapDbProfileToUserProfileInternal(profile, metrics);
}

export async function fallbackDeleteOwnAccount(): Promise<SuccessResponse> {
  let { error } = await supabase.rpc("delete_own_account");
  if (error) {
    const lowered = String(error.message || "").toLowerCase();
    const shouldRetry =
      lowered.includes("invalid jwt") ||
      lowered.includes("unauthorized") ||
      lowered.includes("jwt");
    if (shouldRetry) {
      await supabase.auth.refreshSession().catch(() => null);
      const retry = await supabase.rpc("delete_own_account");
      error = retry.error;
    }
  }
  if (error) {
    const message = String(error.message || "");
    if (message.toLowerCase().includes("delete_own_account")) {
      throw new Error(
        "Hesap silme fonksiyonu bulunamadı. Lütfen veritabanı migrationlarını çalıştır.",
      );
    }
    throw new Error(message || "Hesap silinemedi");
  }
  return { success: true };
}

export async function fallbackRegisterToTable(payload: RegisterPayload): Promise<RegisterResponse> {
  const isPrivate = resolveProfilePrivacy(payload.accountType, payload.isPrivate ?? false);
  const insertPayload: Record<string, string | string[] | boolean | null> = {
    user_id: payload.userId,
    username: payload.username.trim().toLowerCase(),
    account_type: payload.accountType,
    email: payload.email.trim().toLowerCase(),
    university: payload.university,
    categories: payload.categories || [],
    is_private: isPrivate,
    profile_image_path: payload.profileImage || null,
    cover_image_path: payload.coverImage || null,
    department: payload.department || null,
    grade_year: payload.gradeYear || null,
    bio: payload.bio || null,
    description: payload.description || null,
  };

  if (payload.accountType === "club") {
    insertPayload.club_name = payload.clubName || payload.username;
    insertPayload.name = null;
  } else {
    insertPayload.name = payload.name || payload.username;
    insertPayload.club_name = null;
  }

  const { error } = await supabase.from("profiles").insert(insertPayload);
  if (error) {
    const msg = String(error.message || "");
    if (
      msg.includes("Could not find the table") ||
      (msg.includes("relation") && msg.includes("profiles"))
    ) {
      throw new Error(
        "Sunucu kurulumu eksik: profiles tablosu bulunamadı. Supabase migrationlarını çalıştır.",
      );
    }
    if (msg.includes("profiles_username_key")) {
      throw new Error("Bu kullanıcı adi zaten alınmış");
    }
    if (msg.includes("profiles_email_key")) {
      throw new Error("Bu e-posta adresi zaten kullanılıyor");
    }
    throw new Error(msg || "Kayıt sirasinda bir hata olustu");
  }

  return { success: true, userId: payload.userId };
}
