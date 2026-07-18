import type { AlbumPhotoWithMeta } from "../contracts/content";
import type { AlbumSurfaceVisibilitySnapshot } from "../contracts/entities";
import { normalizeImageVariants } from "./media";
import { isEventProjectionLike } from "./events.shapes";
import { resolveAlbumSurfaceVisibility } from "./albums.surface";

export interface AlbumProjectionRpcRow {
  photo_id: string;
  event_id: string | null;
  storage_path: string;
  media_paths: string[] | null;
  photo_count: number | null;
  caption: string | null;
  title: string | null;
  show_on_profile: boolean;
  show_on_user_profile?: boolean | null;
  show_on_club_profile?: boolean | null;
  created_at: string;
  uploader_id: string;
  uploader_username: string;
  uploader_name: string;
  uploader_university: string | null;
  uploader_image: string | null;
  uploader_is_private: boolean;
  club_id: string | null;
  club_username: string | null;
  club_name: string | null;
  club_is_private: boolean;
  event_title: string | null;
  event_visibility: "public" | "members_only";
  effective_visibility: "public" | "followers_only" | "members_only";
  likes_count: number;
  comments_count: number;
  liked: boolean;
  discoverable?: boolean | null;
  openable?: boolean | null;
  open_event_detail?: boolean | null;
  interactable?: boolean | null;
  locked_reason_code?: string | null;
  locked_reason_text?: string | null;
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasBooleanValue(value: unknown) {
  return typeof value === "boolean";
}

function hasExplicitSurfaceFlag(value: unknown) {
  return typeof value === "boolean";
}

function resolveInputSurfaceVisibility(value: unknown): AlbumSurfaceVisibilitySnapshot | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.showOnOwnProfile !== "boolean" ||
    typeof item.showOnClubProfile !== "boolean" ||
    typeof item.showOnProfile !== "boolean" ||
    !item.label ||
    typeof item.label !== "object"
  ) {
    return undefined;
  }
  const label = item.label as Record<string, unknown>;
  if ((label.type !== "club" && label.type !== "own") || typeof label.text !== "string") {
    return undefined;
  }

  return {
    label: {
      text: label.text,
      type: label.type,
    },
    showOnClubProfile: item.showOnClubProfile,
    showOnOwnProfile: item.showOnOwnProfile,
    showOnProfile: item.showOnProfile,
  };
}

export function hasAlbumProjectionSurfaceFlags(row: unknown) {
  if (!row || typeof row !== "object") return false;
  const item = row as Record<string, unknown>;
  const surfaceVisibility =
    item.surfaceVisibility && typeof item.surfaceVisibility === "object"
      ? (item.surfaceVisibility as Record<string, unknown>)
      : null;

  const hasOwnFlag =
    hasExplicitSurfaceFlag(item.showOnOwnProfile) ||
    hasExplicitSurfaceFlag(item.show_on_user_profile) ||
    hasExplicitSurfaceFlag(surfaceVisibility?.showOnOwnProfile);
  const hasClubFlag =
    hasExplicitSurfaceFlag(item.showOnClubProfile) ||
    hasExplicitSurfaceFlag(item.show_on_club_profile) ||
    hasExplicitSurfaceFlag(surfaceVisibility?.showOnClubProfile);

  return hasOwnFlag && hasClubFlag;
}

function hasAlbumProjectionMarkers(item: Record<string, unknown>) {
  return (
    hasNonEmptyString(item.photo_id) ||
    hasNonEmptyString(item.uploader_id) ||
    hasNonEmptyString(item.eventId) ||
    hasNonEmptyString(item.event_id) ||
    hasNonEmptyString(item.eventTitle) ||
    hasNonEmptyString(item.event_title) ||
    Array.isArray(item.images) ||
    Array.isArray(item.media_paths) ||
    hasNumericValue(item.photoCount) ||
    hasNumericValue(item.photo_count) ||
    hasNonEmptyString(item.caption) ||
    hasBooleanValue(item.showOnProfile) ||
    hasBooleanValue(item.show_on_profile) ||
    hasBooleanValue(item.showOnOwnProfile) ||
    hasBooleanValue(item.show_on_user_profile) ||
    hasBooleanValue(item.showOnClubProfile) ||
    hasBooleanValue(item.show_on_club_profile) ||
    hasBooleanValue(item.viewerJoinedEvent) ||
    hasBooleanValue(item.viewer_joined_event) ||
    hasBooleanValue(item.canOpenAlbum) ||
    hasBooleanValue(item.canOpenAlbumEventDetail) ||
    hasBooleanValue(item.canInteractAlbum)
  );
}

export function mapAlbumProjectionRow(row: AlbumProjectionRpcRow): AlbumPhotoWithMeta {
  const images =
    Array.isArray(row.media_paths) && row.media_paths.length > 0
      ? row.media_paths
      : [row.storage_path];
  const surfaceVisibility = resolveAlbumSurfaceVisibility({
    showOnClubProfile:
      typeof row.show_on_club_profile === "boolean" ? row.show_on_club_profile : undefined,
    showOnOwnProfile:
      typeof row.show_on_user_profile === "boolean" ? row.show_on_user_profile : undefined,
    showOnProfile: Boolean(row.show_on_profile),
  });

  return {
    id: row.photo_id,
    userId: row.uploader_id,
    username: row.uploader_username || "",
    name: row.uploader_name || row.uploader_username || "",
    userImage: row.uploader_image || "",
    userUniversity: row.uploader_university || "",
    eventId: row.event_id || "",
    eventTitle: row.event_title || "",
    clubName: row.club_name || undefined,
    image: row.storage_path || images[0] || "",
    imageVariants: normalizeImageVariants(
      (row as AlbumProjectionRpcRow & { image_variants?: unknown }).image_variants,
    ),
    images,
    photoCount: Number(row.photo_count || images.length || 1),
    caption: row.caption || undefined,
    createdAt: row.created_at,
    likes: Number(row.likes_count || 0),
    liked: Boolean(row.liked),
    comments: Number(row.comments_count || 0),
    title: row.title || undefined,
    showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
    showOnClubProfile: surfaceVisibility.showOnClubProfile,
    showOnProfile: surfaceVisibility.showOnProfile,
    surfaceVisibility,
    eventVisibility: row.event_visibility || "public",
    effectiveVisibility: row.effective_visibility || "public",
    clubUserId: row.club_id || undefined,
    clubUsername: row.club_username || undefined,
    clubIsPrivate: Boolean(row.club_is_private),
    uploaderIsPrivate: Boolean(row.uploader_is_private),
    canDiscoverAlbum: typeof row.discoverable === "boolean" ? row.discoverable : undefined,
    canOpenAlbum: typeof row.openable === "boolean" ? row.openable : undefined,
    canOpenAlbumEventDetail:
      typeof row.open_event_detail === "boolean" ? row.open_event_detail : undefined,
    canInteractAlbum: typeof row.interactable === "boolean" ? row.interactable : undefined,
    lockedReasonCode: row.locked_reason_code || undefined,
    lockedReasonText: row.locked_reason_text || undefined,
  };
}

export function normalizeAlbumProjectionItem(row: unknown): AlbumPhotoWithMeta | null {
  if (!row || typeof row !== "object") return null;

  const item = row as Record<string, unknown>;
  if (item.photo_id || item.uploader_id || item.event_id) {
    return mapAlbumProjectionRow(item as unknown as AlbumProjectionRpcRow);
  }

  const id = String(item.id || "").trim();
  if (!id) return null;
  if (!hasAlbumProjectionMarkers(item) && isEventProjectionLike(item)) {
    return null;
  }

  const images = Array.isArray(item.images)
    ? item.images.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const primaryImage = String(item.image || "").trim();
  const inputSurfaceVisibility = resolveInputSurfaceVisibility(item.surfaceVisibility);
  const surfaceVisibility = resolveAlbumSurfaceVisibility({
    surfaceVisibility: inputSurfaceVisibility,
    showOnClubProfile:
      typeof item.showOnClubProfile === "boolean"
        ? item.showOnClubProfile
        : typeof item.show_on_club_profile === "boolean"
          ? item.show_on_club_profile
          : undefined,
    showOnOwnProfile:
      typeof item.showOnOwnProfile === "boolean"
        ? item.showOnOwnProfile
        : typeof item.show_on_user_profile === "boolean"
          ? item.show_on_user_profile
          : undefined,
    showOnProfile:
      typeof item.showOnProfile === "boolean"
        ? item.showOnProfile
        : typeof item.show_on_profile === "boolean"
          ? item.show_on_profile
          : undefined,
  });

  return {
    id,
    userId: String(item.userId || item.user_id || ""),
    username: String(item.username || ""),
    name: String(item.name || item.username || "Kullanıcı"),
    userImage: String(item.userImage || item.user_image || item.image || ""),
    userUniversity: String(item.userUniversity || item.user_university || item.university || ""),
    eventId: String(item.eventId || item.event_id || ""),
    eventTitle: String(item.eventTitle || item.event_title || ""),
    clubName:
      typeof item.clubName === "string"
        ? item.clubName
        : typeof item.club_name === "string"
          ? item.club_name
          : undefined,
    image: primaryImage || images[0] || "",
    imageVariants: normalizeImageVariants(item.imageVariants || item.image_variants),
    images: images.length > 0 ? images : primaryImage ? [primaryImage] : undefined,
    photoCount: Number(item.photoCount || item.photo_count || images.length || 1),
    caption: typeof item.caption === "string" ? item.caption : undefined,
    createdAt: String(item.createdAt || item.created_at || ""),
    likes: Number(item.likes || item.likes_count || 0),
    liked: Boolean(item.liked),
    comments: Number(item.comments || item.comments_count || 0),
    title: typeof item.title === "string" ? item.title : undefined,
    showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
    showOnClubProfile: surfaceVisibility.showOnClubProfile,
    showOnProfile: surfaceVisibility.showOnProfile,
    surfaceVisibility,
    eventVisibility: (String(item.eventVisibility || item.event_visibility || "public") ||
      "public") as "public" | "members_only",
    effectiveVisibility: (String(
      item.effectiveVisibility || item.effective_visibility || "public",
    ) || "public") as "public" | "followers_only" | "members_only",
    clubUserId:
      typeof item.clubUserId === "string"
        ? item.clubUserId
        : typeof item.club_id === "string"
          ? item.club_id
          : undefined,
    clubUsername:
      typeof item.clubUsername === "string"
        ? item.clubUsername
        : typeof item.club_username === "string"
          ? item.club_username
          : undefined,
    clubIsPrivate:
      typeof item.clubIsPrivate === "boolean"
        ? item.clubIsPrivate
        : typeof item.club_is_private === "boolean"
          ? item.club_is_private
          : false,
    uploaderIsPrivate: Boolean(item.uploaderIsPrivate || item.uploader_is_private),
    viewerJoinedEvent:
      typeof item.viewerJoinedEvent === "boolean"
        ? item.viewerJoinedEvent
        : typeof item.viewer_joined_event === "boolean"
          ? item.viewer_joined_event
          : undefined,
    canDiscoverAlbum:
      typeof item.canDiscoverAlbum === "boolean" ? item.canDiscoverAlbum : undefined,
    canOpenAlbum: typeof item.canOpenAlbum === "boolean" ? item.canOpenAlbum : undefined,
    canOpenAlbumEventDetail:
      typeof item.canOpenAlbumEventDetail === "boolean" ? item.canOpenAlbumEventDetail : undefined,
    canInteractAlbum:
      typeof item.canInteractAlbum === "boolean" ? item.canInteractAlbum : undefined,
    lockedReasonCode:
      typeof item.lockedReasonCode === "string"
        ? item.lockedReasonCode
        : typeof item.locked_reason_code === "string"
          ? item.locked_reason_code
          : undefined,
    lockedReasonText:
      typeof item.lockedReasonText === "string"
        ? item.lockedReasonText
        : typeof item.locked_reason_text === "string"
          ? item.locked_reason_text
          : undefined,
  };
}
