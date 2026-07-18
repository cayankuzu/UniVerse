import { supabase } from "../../platform/supabase";
import { hardSignOut } from "../security/authSessionBoundary";
import type { UserProfile } from "../contracts/entities";
import type { RegisterDirectPayload } from "./auth.shared";

export type GetMeOptions = {
  allowHardSignOut?: boolean;
  includeMetrics?: boolean;
  recoverSessionOnUnauthorized?: boolean;
};

export type EmailVerificationBypassResponse = {
  success: boolean;
  userId?: string;
};

export async function throwGetMeFailure(message: string, options?: GetMeOptions): Promise<never> {
  if (options?.allowHardSignOut) {
    await hardSignOut("auth-recovery-failed");
  }
  throw new Error(message);
}

export function buildAuthUserMetadata(profile: UserProfile) {
  const isPrivate = profile.accountType === "club" ? false : Boolean(profile.isPrivate);
  return {
    accountType: profile.accountType,
    account_type: profile.accountType,
    username: profile.username,
    email: profile.email,
    university: profile.university,
    department: profile.department || "",
    gradeYear: profile.gradeYear || "",
    grade_year: profile.gradeYear || "",
    bio: profile.bio || "",
    description: profile.description || "",
    profileImage: profile.profileImage || "",
    coverImage: profile.coverImage || "",
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    isPrivate,
    is_private: isPrivate,
    hideEmail: Boolean(profile.hideEmail),
    hide_email: Boolean(profile.hideEmail),
    name: profile.name || "",
    clubName: profile.clubName || "",
    club_name: profile.clubName || "",
  };
}

export function buildRegisterDirectMetadata(
  payload: RegisterDirectPayload,
  normalizedEmail: string,
  normalizedUsername: string,
  registrationNonce?: string,
) {
  const accountType = payload.accountType === "club" ? "club" : "student";
  const isPrivate = accountType === "club" ? false : Boolean(payload.isPrivate);
  const displayName =
    accountType === "club"
      ? String(payload.clubName || normalizedUsername).trim() || normalizedUsername
      : String(payload.name || normalizedUsername).trim() || normalizedUsername;

  return {
    accountType,
    account_type: accountType,
    username: normalizedUsername,
    email: normalizedEmail,
    university: String(payload.university || "").trim() || "Belirtilmedi",
    department: String(payload.department || "").trim(),
    gradeYear: String(payload.gradeYear || "").trim(),
    grade_year: String(payload.gradeYear || "").trim(),
    bio: String(payload.bio || "").trim(),
    description: String(payload.description || "").trim(),
    profileImage: String(payload.profileImage || "").trim(),
    coverImage: String(payload.coverImage || "").trim(),
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    isPrivate,
    is_private: isPrivate,
    hideEmail: false,
    hide_email: false,
    name: accountType === "student" ? displayName : "",
    clubName: accountType === "club" ? displayName : "",
    club_name: accountType === "club" ? displayName : "",
    registrationNonce: registrationNonce || "",
    registration_nonce: registrationNonce || "",
  };
}

export function buildRegistrationNonce() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  return `signup_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function syncCurrentAuthMetadata(profile: UserProfile) {
  const { error } = await supabase.auth.updateUser({
    data: buildAuthUserMetadata(profile),
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function syncCurrentAuthUser(
  profile: UserProfile,
  options?: { includeEmail?: boolean },
) {
  const payload: {
    data: ReturnType<typeof buildAuthUserMetadata>;
    email?: string;
  } = {
    data: buildAuthUserMetadata(profile),
  };
  if (options?.includeEmail && profile.email) {
    payload.email = profile.email.trim().toLowerCase();
  }

  const { error } = await supabase.auth.updateUser(payload);
  if (error) {
    throw new Error(error.message);
  }
}
