import type { UserProfile } from "../../../data/contracts/entities";

export function buildResolvedProfileUserData(
  userData: {
    bio?: string | null;
    categories?: string[] | null;
    clubName?: string | null;
    coverImage?: string | null;
    department?: string | null;
    description?: string | null;
    email?: string | null;
    followers?: number | null;
    following?: number | null;
    gradeYear?: string | null;
    hideEmail?: boolean | null;
    id?: string | null;
    isPrivate?: boolean | null;
    name?: string | null;
    profileImage?: string | null;
    profileImageVariants?: UserProfile["profileImageVariants"] | null;
    university?: string | null;
    username?: string | null;
    coverImageVariants?: UserProfile["coverImageVariants"] | null;
  },
  profile: UserProfile | undefined,
) {
  if (!profile) return userData;

  return {
    ...userData,
    bio: profile.bio ?? userData.bio,
    categories: Array.isArray(profile.categories) ? profile.categories : userData.categories,
    clubName: profile.clubName ?? userData.clubName,
    coverImage: profile.coverImage || userData.coverImage,
    coverImageVariants: profile.coverImageVariants ?? userData.coverImageVariants,
    department: profile.department ?? userData.department,
    description: profile.description ?? userData.description,
    email: profile.email || userData.email,
    followers: Number(profile.followersCount ?? userData.followers ?? 0),
    following: Number(profile.followingCount ?? userData.following ?? 0),
    gradeYear: profile.gradeYear ?? userData.gradeYear,
    hideEmail: profile.hideEmail ?? userData.hideEmail,
    id: profile.id || userData.id,
    isPrivate: profile.isPrivate ?? userData.isPrivate,
    name: profile.name ?? userData.name,
    profileImage: profile.profileImage || userData.profileImage,
    profileImageVariants: profile.profileImageVariants ?? userData.profileImageVariants,
    university: profile.university || userData.university,
    username: profile.username || userData.username,
  };
}
