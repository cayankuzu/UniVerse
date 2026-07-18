import { supabase } from "../../platform/supabase";
import type { AccountType } from "../contracts/api";
import type { UserProfile } from "../contracts/entities";
import { getCurrentAuthUserOrThrow } from "./authSession.shared";
import {
  buildUsernameCandidates,
  isEmailConflict,
  isUsernameConflict,
  normalizeProfileSyncCategories,
  normalizeProfileSyncEmail,
  normalizeProfileSyncUsername,
  profileSyncBoolean,
} from "./authProfileSync.shared";

export async function upsertProfileFromUserData(data: {
  userId: string;
  accountType: AccountType;
  username: string;
  email: string;
  university: string;
  categories?: string[];
  isPrivate?: boolean;
  hideEmail?: boolean;
  profileImage?: string;
  coverImage?: string;
  name?: string;
  clubName?: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
}) {
  const accountType = data.accountType === "club" ? "club" : "student";
  const isPrivate = accountType === "club" ? false : Boolean(data.isPrivate);
  const username = normalizeProfileSyncUsername(data.username || "");
  const email = normalizeProfileSyncEmail(data.email || "");
  const university = String(data.university || "").trim() || "Belirtilmedi";

  if (!username || username.length < 3) {
    throw new Error("Geçersiz kullanıcı adı");
  }
  if (!email) {
    throw new Error("Geçersiz e-posta");
  }

  const payload: Record<string, string | string[] | boolean | null> = {
    user_id: data.userId,
    account_type: accountType,
    username,
    email,
    university,
    categories: Array.isArray(data.categories) ? data.categories : [],
    is_private: isPrivate,
    hide_email: Boolean(data.hideEmail),
    profile_image_path: data.profileImage || null,
    cover_image_path: data.coverImage || null,
    department: data.department || null,
    grade_year: data.gradeYear || null,
    bio: data.bio || null,
    description: data.description || null,
    name: accountType === "student" ? String(data.name || username).trim() || username : null,
    club_name: accountType === "club" ? String(data.clubName || username).trim() || username : null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function ensureCurrentUserProfileRow(seed?: Partial<UserProfile>): Promise<void> {
  const user = await getCurrentAuthUserOrThrow();

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const accountTypeSource = seed?.accountType ?? metadata.accountType ?? metadata.account_type;
  const accountType: AccountType = accountTypeSource === "club" ? "club" : "student";

  const primaryEmail =
    normalizeProfileSyncEmail(String(seed?.email || user.email || metadata.email || "")) ||
    `${String(user.id)
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()}@profile.local`;
  const backupEmail = `${String(user.id)
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()}@profile.local`;
  const emailCandidates = Array.from(new Set([primaryEmail, backupEmail].filter(Boolean)));

  const university = String(seed?.university || metadata.university || "").trim() || "Belirtilmedi";
  const categories = normalizeProfileSyncCategories(seed?.categories ?? metadata.categories);
  const name = String(seed?.name || metadata.name || metadata.full_name || "").trim();
  const clubName = String(seed?.clubName || metadata.clubName || metadata.club_name || "").trim();
  const profileImage = String(
    seed?.profileImage || metadata.profileImage || metadata.avatar_url || "",
  ).trim();
  const coverImage = String(seed?.coverImage || metadata.coverImage || "").trim();
  const department = String(seed?.department || metadata.department || "").trim();
  const gradeYear = String(
    seed?.gradeYear || metadata.gradeYear || metadata.grade_year || "",
  ).trim();
  const bio = String(seed?.bio || metadata.bio || "").trim();
  const description = String(seed?.description || metadata.description || "").trim();
  const baseUsername = String(seed?.username || metadata.username || "").trim();

  let lastError: unknown = null;

  for (const email of emailCandidates) {
    const usernameCandidates = buildUsernameCandidates(baseUsername, email, user.id);
    for (const username of usernameCandidates) {
      try {
        await upsertProfileFromUserData({
          userId: user.id,
          accountType,
          username,
          email,
          university,
          categories,
          isPrivate: seed?.isPrivate ?? profileSyncBoolean(metadata.isPrivate),
          hideEmail:
            seed?.hideEmail ?? profileSyncBoolean(metadata.hideEmail ?? metadata.hide_email),
          profileImage,
          coverImage,
          name: accountType === "student" ? name || username : "",
          clubName: accountType === "club" ? clubName || username : "",
          department,
          gradeYear,
          bio,
          description,
        });
        return;
      } catch (error) {
        lastError = error;
        const message = String((error as { message?: string })?.message || error || "");
        if (isUsernameConflict(message)) {
          continue;
        }
        if (isEmailConflict(message)) {
          break;
        }
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Profil oluşturulamadı");
}

export async function hasProfileConflict(params: {
  column: "email" | "username";
  currentUserId: string;
  value: string;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq(params.column, params.value)
    .neq("user_id", params.currentUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.user_id);
}
