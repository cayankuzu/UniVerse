export type AlbumSurfaceValue = Partial<{
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  showOnProfile: boolean;
  show_on_club_profile: boolean;
  show_on_profile: boolean;
  show_on_user_profile: boolean;
}>;

type DbPhotoSurfaceRow = {
  media_paths?: string[] | null;
  storage_path?: string | null;
};

export function normalizeAlbumSurfaceVisibility(value: AlbumSurfaceValue) {
  const rawShowOnProfile =
    typeof value.showOnProfile === "boolean"
      ? value.showOnProfile
      : typeof value.show_on_profile === "boolean"
        ? value.show_on_profile
        : false;
  const rawShowOnOwnProfile =
    typeof value.showOnOwnProfile === "boolean"
      ? value.showOnOwnProfile
      : typeof value.show_on_user_profile === "boolean"
        ? value.show_on_user_profile
        : rawShowOnProfile;
  const rawShowOnClubProfile =
    typeof value.showOnClubProfile === "boolean"
      ? value.showOnClubProfile
      : typeof value.show_on_club_profile === "boolean"
        ? value.show_on_club_profile
        : false;

  return {
    showOnClubProfile: Boolean(rawShowOnClubProfile),
    showOnOwnProfile: Boolean(rawShowOnClubProfile || rawShowOnOwnProfile),
  };
}

export function countAlbumPhotos(row: DbPhotoSurfaceRow) {
  if (Array.isArray(row.media_paths) && row.media_paths.length > 0) {
    return row.media_paths.map((item) => String(item || "").trim()).filter(Boolean).length;
  }
  return String(row.storage_path || "").trim() ? 1 : 0;
}

export function normalizeDbPhotoImages(row: DbPhotoSurfaceRow) {
  if (Array.isArray(row.media_paths) && row.media_paths.length > 0) {
    return row.media_paths.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return row.storage_path ? [String(row.storage_path).trim()].filter(Boolean) : [];
}
