import type { AccountType } from "../contracts/api";
import type { UserProfile } from "../contracts/entities";
import { getCurrentAuthUserOrThrow } from "./authSession.shared";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";
export {
  mapDbProfileToUserProfile,
  mergeProfiles,
  normalizeFollowRequestItem,
  normalizeRemoteUserProfile,
  PROFILE_TABLE_SELECT_COLUMNS,
  scoreProfileCompleteness,
} from "../normalizers/userProfiles";

function normalizeProfileText(value: unknown, fallback = ""): string {
  return String(value || fallback || "").trim();
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return fallback;
}

function sanitizeProfileUsernameFallback(value: string): string {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
  if (normalized.length >= 3) return normalized.slice(0, 24);
  return `user_${normalized || "student"}`.slice(0, 24);
}

function sanitizeProfileUsername(value: unknown, fallback: string): string {
  const normalized = normalizeProfileText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
  if (normalized.length >= 3) return normalized;

  const normalizedFallback = sanitizeProfileUsernameFallback(fallback);
  return normalizedFallback.length >= 3 ? normalizedFallback : `user_${fallback.slice(0, 8)}`;
}

export function buildFallbackProfileFromCurrentUser(): Promise<UserProfile> {
  return (async () => {
    const user = await getCurrentAuthUserOrThrow();
    const metadata = (user.user_metadata || {}) as Record<string, unknown>;
    const accountTypeValue = metadata.accountType || metadata.account_type;
    const accountType: AccountType = accountTypeValue === "club" ? "club" : "student";
    const email = normalizeProfileText(metadata.email || user.email || "").toLowerCase();
    const emailForFallback = normalizeProfileText(user.email || metadata.email || "").toLowerCase();
    const usernameSeed = sanitizeProfileUsername(
      metadata.username || metadata.userName || metadata.user_name || emailForFallback,
      user.id,
    );
    const coverImage = normalizeProfileText(metadata.coverImage || metadata.cover_image);
    const profileImage = normalizeProfileText(
      metadata.profileImage || metadata.avatar_url || metadata.photo,
    );
    const university = normalizeProfileText(
      metadata.university || metadata.school || "Belirtilmedi",
    );
    const rawHideEmail = metadata.hideEmail ?? metadata.hide_email;
    const rawIsPrivate = metadata.isPrivate ?? metadata.is_private;

    return {
      id: user.id,
      username: usernameSeed,
      accountType,
      email: normalizeProfileText(email || emailForFallback || `${user.id}@anon.local`),
      university: university || "Belirtilmedi",
      categories: Array.isArray(metadata.categories)
        ? metadata.categories.filter(Boolean).map(String)
        : [],
      profileImage: profileImage || "",
      coverImage: coverImage || "",
      isPrivate: resolveProfilePrivacy(accountType, toBoolean(rawIsPrivate)),
      hideEmail: toBoolean(rawHideEmail),
      createdAt: user.created_at || new Date().toISOString(),
      followersCount: 0,
      followingCount: 0,
      albumsCount: 0,
      eventsCount: 0,
      name: accountType === "student" ? normalizeProfileText(metadata.name) : undefined,
      department: normalizeProfileText(metadata.department),
      gradeYear: normalizeProfileText(metadata.gradeYear || metadata.grade_year),
      bio: normalizeProfileText(metadata.bio),
      clubName:
        accountType === "club"
          ? normalizeProfileText(metadata.clubName || metadata.club_name)
          : undefined,
      description: normalizeProfileText(metadata.description),
    };
  })();
}
