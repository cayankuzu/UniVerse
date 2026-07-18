import type { AccountType, FollowRequestItem } from "../contracts/api";
import type { UserProfile } from "../contracts/entities";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";

/** Shape of a profile row returned from the `profiles` table. */
interface DbProfileRow {
  account_type?: string;
  bio?: string | null;
  categories?: string[] | null;
  club_name?: string | null;
  cover_image_path?: string | null;
  created_at?: string | null;
  department?: string | null;
  description?: string | null;
  email?: string;
  grade_year?: string | null;
  hide_email?: boolean | null;
  is_private?: boolean | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string;
  user_id: string;
  username: string;
}

/** Shape of a remote profile payload (camelCase or snake_case). */
interface RemoteProfilePayload {
  account_type?: string;
  accountType?: string;
  albums_count?: number;
  albumsCount?: number;
  bio?: string | null;
  categories?: string[] | null;
  club_name?: string | null;
  clubName?: string | null;
  cover_image_path?: string | null;
  coverImage?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  department?: string | null;
  description?: string | null;
  email?: string;
  events_count?: number;
  eventsCount?: number;
  followersCount?: number;
  followingCount?: number;
  grade_year?: string | null;
  gradeYear?: string | null;
  hide_email?: boolean | null;
  hideEmail?: boolean | null;
  id?: string;
  is_private?: boolean | null;
  isPrivate?: boolean | null;
  name?: string | null;
  profile_image_path?: string | null;
  profileImage?: string | null;
  university?: string;
  user_id?: string;
  username?: string;
}

/** Shape of a follow-request item from remote sources. */
interface RemoteFollowRequestPayload {
  account_type?: string;
  accountType?: string;
  club_name?: string | null;
  clubName?: string | null;
  image?: string;
  name?: string | null;
  profile_image_path?: string | null;
  profileImage?: string | null;
  time?: string;
  university?: string;
  username?: string;
}

export const PROFILE_TABLE_SELECT_COLUMNS = [
  "user_id",
  "username",
  "account_type",
  "email",
  "university",
  "categories",
  "profile_image_path",
  "cover_image_path",
  "is_private",
  "hide_email",
  "created_at",
  "name",
  "department",
  "grade_year",
  "bio",
  "club_name",
  "description",
].join(
  ",",
) as "user_id,username,account_type,email,university,categories,profile_image_path,cover_image_path,is_private,hide_email,created_at,name,department,grade_year,bio,club_name,description";

export type ProfileMetrics = {
  albumsCount: number;
  eventsCount: number;
  followersCount: number;
  followingCount: number;
};

function normalizeProfileText(value: unknown, fallback = ""): string {
  return String(value || fallback || "").trim();
}

function isPlaceholderUniversity(value: unknown): boolean {
  const normalized = normalizeProfileText(value).toLowerCase();
  return !normalized || normalized === "belirtilmedi";
}

function pickProfileText(
  primary: unknown,
  fallback: unknown,
  options: { allowPlaceholder?: boolean } = {},
): string {
  const primaryText = normalizeProfileText(primary);
  if (primaryText && (options.allowPlaceholder || !isPlaceholderUniversity(primaryText))) {
    return primaryText;
  }

  const fallbackText = normalizeProfileText(fallback);
  if (fallbackText && (options.allowPlaceholder || !isPlaceholderUniversity(fallbackText))) {
    return fallbackText;
  }

  return primaryText || fallbackText;
}

export function mapDbProfileToUserProfile(
  profile: DbProfileRow,
  metrics: ProfileMetrics,
): UserProfile {
  const accountType = profile.account_type === "club" ? "club" : "student";
  return {
    id: profile.user_id,
    username: profile.username,
    accountType,
    email: profile.email ?? "",
    university: profile.university ?? "",
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    profileImage: profile.profile_image_path || "",
    coverImage: profile.cover_image_path || "",
    isPrivate: resolveProfilePrivacy(accountType, profile.is_private),
    hideEmail: Boolean(profile.hide_email),
    createdAt: profile.created_at || new Date().toISOString(),
    followersCount: metrics.followersCount,
    followingCount: metrics.followingCount,
    albumsCount: metrics.albumsCount,
    eventsCount: metrics.eventsCount,
    name: profile.name || undefined,
    department: profile.department || undefined,
    gradeYear: profile.grade_year || undefined,
    bio: profile.bio || undefined,
    clubName: profile.club_name || undefined,
    description: profile.description || undefined,
  };
}

export function normalizeRemoteUserProfile(profile: RemoteProfilePayload): UserProfile {
  const accountType: AccountType =
    profile?.accountType === "club" || profile?.account_type === "club" ? "club" : "student";
  return {
    id: String(profile?.id || profile?.user_id || ""),
    username: String(profile?.username || "")
      .trim()
      .toLowerCase(),
    accountType,
    email: String(profile?.email || "")
      .trim()
      .toLowerCase(),
    university: String(profile?.university || ""),
    categories: Array.isArray(profile?.categories) ? profile.categories : [],
    profileImage: String(profile?.profileImage || profile?.profile_image_path || ""),
    coverImage: String(profile?.coverImage || profile?.cover_image_path || ""),
    isPrivate: resolveProfilePrivacy(accountType, profile?.isPrivate ?? profile?.is_private),
    hideEmail: Boolean(profile?.hideEmail ?? profile?.hide_email),
    createdAt: String(profile?.createdAt || profile?.created_at || new Date().toISOString()),
    followersCount: Number(profile?.followersCount || 0),
    followingCount: Number(profile?.followingCount || 0),
    albumsCount: Number((profile?.albumsCount ?? profile?.albums_count) || 0),
    eventsCount: Number((profile?.eventsCount ?? profile?.events_count) || 0),
    name: profile?.name ? String(profile.name) : undefined,
    department: profile?.department ? String(profile.department) : undefined,
    gradeYear: profile?.gradeYear
      ? String(profile.gradeYear)
      : profile?.grade_year
        ? String(profile.grade_year)
        : undefined,
    bio: profile?.bio ? String(profile.bio) : undefined,
    clubName: profile?.clubName
      ? String(profile.clubName)
      : profile?.club_name
        ? String(profile.club_name)
        : undefined,
    description: profile?.description ? String(profile.description) : undefined,
  };
}

export function normalizeFollowRequestItem(
  item: RemoteFollowRequestPayload,
): FollowRequestItem | null {
  const username = String(item?.username || "")
    .trim()
    .toLowerCase();
  if (!username) return null;
  return {
    username,
    name: String(item?.name || item?.clubName || item?.club_name || username).trim(),
    image: String(item?.image || item?.profileImage || item?.profile_image_path || "").trim(),
    university: String(item?.university || "").trim(),
    accountType: item?.accountType === "club" || item?.account_type === "club" ? "club" : "student",
    time: String(item?.time || ""),
  };
}

export function scoreProfileCompleteness(profile: UserProfile | null | undefined): number {
  if (!profile) return -1;
  let score = 0;

  if (normalizeProfileText(profile.name || profile.clubName)) score += 3;
  if (!isPlaceholderUniversity(profile.university)) score += 2;
  if (Array.isArray(profile.categories) && profile.categories.length > 0) score += 1;
  if (normalizeProfileText(profile.profileImage)) score += 2;
  if (normalizeProfileText(profile.coverImage)) score += 2;
  if (normalizeProfileText(profile.department)) score += 1;
  if (normalizeProfileText(profile.gradeYear)) score += 1;
  if (normalizeProfileText(profile.bio)) score += 1;
  if (normalizeProfileText(profile.description)) score += 1;
  if (Number(profile.followersCount || 0) > 0) score += 1;
  if (Number(profile.followingCount || 0) > 0) score += 1;
  if (Number(profile.albumsCount || 0) > 0) score += 1;
  if (Number(profile.eventsCount || 0) > 0) score += 1;

  return score;
}

export function mergeProfiles(primary: UserProfile, fallback: UserProfile): UserProfile {
  const accountType = primary.accountType || fallback.accountType;
  return {
    id: primary.id || fallback.id,
    username: pickProfileText(primary.username, fallback.username, {
      allowPlaceholder: true,
    }).toLowerCase(),
    accountType,
    email: pickProfileText(primary.email, fallback.email, { allowPlaceholder: true }).toLowerCase(),
    university: pickProfileText(primary.university, fallback.university) || "Belirtilmedi",
    categories:
      Array.isArray(primary.categories) && primary.categories.length > 0
        ? primary.categories
        : Array.isArray(fallback.categories)
          ? fallback.categories
          : [],
    profileImage: pickProfileText(primary.profileImage, fallback.profileImage, {
      allowPlaceholder: true,
    }),
    coverImage: pickProfileText(primary.coverImage, fallback.coverImage, {
      allowPlaceholder: true,
    }),
    isPrivate: resolveProfilePrivacy(accountType, primary.isPrivate ?? fallback.isPrivate),
    hideEmail: primary.hideEmail ?? fallback.hideEmail,
    createdAt:
      pickProfileText(primary.createdAt, fallback.createdAt, { allowPlaceholder: true }) ||
      new Date().toISOString(),
    followersCount: Math.max(
      Number(primary.followersCount || 0),
      Number(fallback.followersCount || 0),
    ),
    followingCount: Math.max(
      Number(primary.followingCount || 0),
      Number(fallback.followingCount || 0),
    ),
    albumsCount: Math.max(Number(primary.albumsCount || 0), Number(fallback.albumsCount || 0)),
    eventsCount: Math.max(Number(primary.eventsCount || 0), Number(fallback.eventsCount || 0)),
    name: pickProfileText(primary.name, fallback.name, { allowPlaceholder: true }) || undefined,
    department:
      pickProfileText(primary.department, fallback.department, { allowPlaceholder: true }) ||
      undefined,
    gradeYear:
      pickProfileText(primary.gradeYear, fallback.gradeYear, { allowPlaceholder: true }) ||
      undefined,
    bio: pickProfileText(primary.bio, fallback.bio, { allowPlaceholder: true }) || undefined,
    clubName:
      pickProfileText(primary.clubName, fallback.clubName, { allowPlaceholder: true }) || undefined,
    description:
      pickProfileText(primary.description, fallback.description, { allowPlaceholder: true }) ||
      undefined,
  };
}
