export function toDisplayName(profile: {
  name?: string | null;
  club_name?: string | null;
  username?: string | null;
}) {
  return profile.name || profile.club_name || profile.username || "";
}
