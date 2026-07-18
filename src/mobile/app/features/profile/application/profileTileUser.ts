import { resolveProfilePrivacy } from "../../../data/policies/profilePrivacy";

/** Raw profile-like payload from various sources (DB rows, API responses). */
interface ProfileTileInput {
  about?: string;
  account_type?: string;
  accountType?: string;
  bio?: string;
  biography?: string;
  categories?: string[];
  category?: string;
  cover_image?: string;
  cover_image_path?: string;
  coverImage?: string;
  department?: string;
  description?: string;
  id?: string;
  image?: string;
  is_private?: boolean;
  isPrivate?: boolean;
  name?: string;
  club_name?: string;
  clubName?: string;
  profile_image?: string;
  profile_image_path?: string;
  profileImage?: string;
  university?: string;
  user_id?: string;
  userId?: string;
  username?: string;
  year?: string;
  grade_year?: string;
  gradeYear?: string;
}

export function normalizeProfileTileUser(item: ProfileTileInput) {
  return {
    accountType: item.accountType || item.account_type || undefined,
    bio: item.bio || item.about || item.biography || "",
    categories: Array.isArray(item.categories) ? item.categories : [],
    category: item.category || (Array.isArray(item.categories) ? item.categories[0] : "") || "",
    coverImage: item.coverImage || item.cover_image || item.cover_image_path || "",
    department: item.department || "",
    description: item.description || "",
    id: item.id || item.userId || item.user_id || item.username || "",
    image: item.image || item.profileImage || item.profile_image || item.profile_image_path || "",
    isPrivate: resolveProfilePrivacy(
      item.accountType || item.account_type,
      item.isPrivate ?? item.is_private,
    ),
    name: item.name || item.clubName || item.club_name || item.username || "",
    university: item.university || "",
    username: item.username || "",
    year: item.year || item.gradeYear || item.grade_year || "",
  };
}
