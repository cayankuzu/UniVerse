import type { SearchUserResult } from "../contracts/api";
import { normalizeImageVariants } from "./media";
import { toDisplayName } from "../profile/profileDisplay";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";

export function mapFollowUser(profile: Record<string, unknown>): SearchUserResult {
  return {
    id: String(profile.user_id || ""),
    username: String(profile.username || ""),
    name: toDisplayName(profile),
    image: String(profile.profile_image_path || profile.profile_image || ""),
    coverImage: String(profile.cover_image_path || profile.cover_image || ""),
    university: String(profile.university || ""),
    isPrivate: resolveProfilePrivacy(
      profile.account_type as string | undefined,
      profile.is_private,
    ),
    accountType:
      profile.account_type === "club"
        ? "club"
        : profile.account_type === "student"
          ? "student"
          : undefined,
    department: typeof profile.department === "string" ? profile.department : undefined,
    year: typeof profile.grade_year === "string" ? profile.grade_year : undefined,
    category: Array.isArray(profile.categories)
      ? profile.categories.find((value): value is string => typeof value === "string")
      : typeof profile.category === "string"
        ? profile.category
        : undefined,
    categories: Array.isArray(profile.categories)
      ? profile.categories.filter((value): value is string => typeof value === "string")
      : [],
    bio: typeof profile.bio === "string" ? profile.bio : undefined,
    description: typeof profile.description === "string" ? profile.description : undefined,
  };
}

export function normalizeSearchUserResult(row: unknown): SearchUserResult | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const rawId = String(item.id || item.userId || item.user_id || "").trim();
  const rawUsername = String(item.username || "").trim();
  if (!rawId && !rawUsername) return null;

  return {
    id: rawId || rawUsername,
    username: rawUsername || `user_${String(rawId).slice(0, 8)}`,
    name: String(
      item.name ||
        item.clubName ||
        item.clubname ||
        item.club_name ||
        item.displayName ||
        item.displayname ||
        item.display_name ||
        rawUsername ||
        "Kullanıcı",
    ),
    image: String(
      item.image ||
        item.profileImage ||
        item.profileimage ||
        item.profile_image ||
        item.profile_image_path ||
        "",
    ),
    imageVariants: normalizeImageVariants(item.imageVariants || item.image_variants),
    coverImage: String(
      item.coverImage || item.coverimage || item.cover_image || item.cover_image_path || "",
    ),
    coverImageVariants: normalizeImageVariants(
      item.coverImageVariants || item.cover_image_variants,
    ),
    university: String(item.university || ""),
    isPrivate: resolveProfilePrivacy(
      item.accountType === "club" || item.account_type === "club" || item.accounttype === "club"
        ? "club"
        : item.accountType === "student" ||
            item.account_type === "student" ||
            item.accounttype === "student"
          ? "student"
          : undefined,
      item.isPrivate ?? item.is_private ?? item.isprivate,
    ),
    accountType:
      item.accountType === "club" || item.account_type === "club" || item.accounttype === "club"
        ? "club"
        : item.accountType === "student" ||
            item.account_type === "student" ||
            item.accounttype === "student"
          ? "student"
          : undefined,
    department: typeof item.department === "string" ? item.department : undefined,
    year:
      typeof item.year === "string"
        ? item.year
        : typeof item.gradeYear === "string"
          ? item.gradeYear
          : typeof item.gradeyear === "string"
            ? item.gradeyear
            : typeof item.grade_year === "string"
              ? item.grade_year
              : undefined,
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : typeof item.createdat === "string"
          ? item.createdat
          : undefined,
    category:
      typeof item.category === "string"
        ? item.category
        : Array.isArray(item.categories)
          ? item.categories.find((value): value is string => typeof value === "string")
          : undefined,
    categories: Array.isArray(item.categories)
      ? item.categories.filter((value): value is string => typeof value === "string")
      : undefined,
    bio:
      typeof item.bio === "string"
        ? item.bio
        : typeof item.biography === "string"
          ? item.biography
          : typeof item.about === "string"
            ? item.about
            : undefined,
    description: typeof item.description === "string" ? item.description : undefined,
  };
}

export function buildHiddenLikeUser(userId: string, index: number): SearchUserResult {
  const shortId = String(userId || "")
    .replace(/-/g, "")
    .slice(0, 8);
  const safeSuffix = shortId || String(index + 1);
  return {
    id: userId || `hidden-${safeSuffix}`,
    username: `gizli_${safeSuffix}`,
    name: "Gizli Kullanıcı",
    image: "",
    coverImage: "",
    university: "",
    isPrivate: true,
  };
}
