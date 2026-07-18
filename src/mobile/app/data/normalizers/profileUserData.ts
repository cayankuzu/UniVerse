import type { AuthUserData, UserProfile } from "../contracts/entities";

export function profileToUserData(profile: UserProfile): AuthUserData {
  const isPrivate = profile?.accountType === "club" ? false : (profile?.isPrivate ?? false);
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name ?? "",
    clubName: profile.clubName ?? "",
    email: profile.email,
    university: profile.university,
    department: profile.department ?? "",
    gradeYear: profile.gradeYear ?? "",
    bio: profile.bio ?? "",
    description: profile.description ?? "",
    profileImage: profile.profileImage,
    coverImage: profile.coverImage,
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    followers: profile.followersCount ?? 0,
    following: profile.followingCount ?? 0,
    albums: profile.albumsCount ?? 0,
    events: profile.eventsCount ?? 0,
    isPrivate,
    hideEmail: profile.hideEmail ?? false,
  };
}
