import type { AlbumSurfaceVisibilitySnapshot } from "../contracts/entities";

export type EventAccessResult = {
  canView: boolean;
  reason?: string;
};

export type AlbumAccessResult = {
  canView: boolean;
  reason?: string;
};

export type EventActionAccess = {
  canJoin: boolean;
  canViewAttendees: boolean;
  canOpenDetail: boolean;
  canOpenAlbum: boolean;
  canUploadAlbum: boolean;
  isMembersOnly: boolean;
  isEligible: boolean;
  isOwnClub: boolean;
  isEnded: boolean;
  reason?: string;
  reasonCode?: string;
  joinReason?: string;
  joinReasonCode?: string;
  attendeesReason?: string;
  attendeesReasonCode?: string;
  albumReason?: string;
  albumReasonCode?: string;
  uploadReason?: string;
  uploadReasonCode?: string;
};

export type AlbumButtonAction = "view_event" | "view_club" | "disabled";

export interface RelationSnapshot {
  followingUsernames?: string[];
  followsClub?: boolean;
  clubIsPrivate?: boolean;
  followsUploader?: boolean;
  uploaderIsPrivate?: boolean;
}

export interface BaseEntity {
  username?: string;
  clubUsername?: string;
  showOnOwnProfile?: boolean;
  showOnClubProfile?: boolean;
  surfaceVisibility?: AlbumSurfaceVisibilitySnapshot | null;
  visibility?: "public" | "members_only";
  eventVisibility?: "public" | "members_only";
  effectiveVisibility?: "public" | "followers_only" | "members_only";
  clubIsPrivate?: boolean;
  uploaderIsPrivate?: boolean;
  viewerJoinedEvent?: boolean;
  showOnProfile?: boolean;
  eventId?: string;
  joined?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  canDiscoverEvent?: boolean;
  canOpenEventDetail?: boolean;
  canAttendEvent?: boolean;
  canViewAttendees?: boolean;
  canOpenEventAlbum?: boolean;
  canUploadEventAlbum?: boolean;
  isEndedOrLocked?: boolean;
  canDiscoverAlbum?: boolean;
  canOpenAlbum?: boolean;
  canOpenAlbumEventDetail?: boolean;
  canInteractAlbum?: boolean;
  lockedReasonCode?: string;
  lockedReasonText?: string;
}

export interface AlbumVisibilityInput {
  surfaceVisibility?:
    | AlbumSurfaceVisibilitySnapshot
    | Partial<
        Pick<
          AlbumSurfaceVisibilitySnapshot,
          "showOnClubProfile" | "showOnOwnProfile" | "showOnProfile"
        >
      >
    | null;
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnProfile?: boolean;
}

export interface AlbumProfileVisibilityState {
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
}

export function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveAlbumSurfaceFlag(
  input: AlbumVisibilityInput,
  key: "showOnClubProfile" | "showOnOwnProfile" | "showOnProfile",
) {
  if (typeof input.surfaceVisibility?.[key] === "boolean") {
    return input.surfaceVisibility[key];
  }
  if (typeof input[key] === "boolean") return input[key];
  return undefined;
}

export function normalizeAlbumVisibility(
  input: AlbumVisibilityInput,
  options?: {
    clubFallbackToProfile?: boolean;
    clubImpliesOwnProfile?: boolean;
    ownFallbackToProfile?: boolean;
  },
) {
  const ownFallbackToProfile = options?.ownFallbackToProfile ?? true;
  const clubFallbackToProfile = options?.clubFallbackToProfile ?? false;
  const clubImpliesOwnProfile = options?.clubImpliesOwnProfile ?? false;
  const showOnOwnProfile = resolveAlbumSurfaceFlag(input, "showOnOwnProfile");
  const showOnClubProfile = resolveAlbumSurfaceFlag(input, "showOnClubProfile");
  const showOnProfile = resolveAlbumSurfaceFlag(input, "showOnProfile");
  const baseOwnProfile =
    typeof showOnOwnProfile === "boolean"
      ? showOnOwnProfile
      : ownFallbackToProfile
        ? Boolean(showOnProfile)
        : false;
  const baseClubProfile =
    typeof showOnClubProfile === "boolean"
      ? showOnClubProfile
      : clubFallbackToProfile
        ? Boolean(showOnProfile)
        : false;
  const normalizedShowOnClubProfile = Boolean(baseClubProfile);
  const normalizedShowOnOwnProfile = Boolean(
    clubImpliesOwnProfile && normalizedShowOnClubProfile ? true : baseOwnProfile,
  );

  return {
    showOnClubProfile: normalizedShowOnClubProfile,
    showOnOwnProfile: normalizedShowOnOwnProfile,
    showOnProfile: Boolean(
      normalizedShowOnOwnProfile || normalizedShowOnClubProfile || showOnProfile,
    ),
  };
}

export function normalizeExplicitAlbumSurfaceVisibility(input: AlbumVisibilityInput = {}) {
  const explicitShowOnOwnProfile = resolveAlbumSurfaceFlag(input, "showOnOwnProfile");
  const explicitShowOnClubProfile = resolveAlbumSurfaceFlag(input, "showOnClubProfile");
  const explicitShowOnProfile = resolveAlbumSurfaceFlag(input, "showOnProfile");
  const showOnOwnProfile =
    typeof explicitShowOnOwnProfile === "boolean" ? explicitShowOnOwnProfile : false;
  const showOnClubProfile =
    typeof explicitShowOnClubProfile === "boolean" ? explicitShowOnClubProfile : false;

  return {
    showOnClubProfile,
    showOnOwnProfile,
    showOnProfile: Boolean(
      typeof explicitShowOnProfile === "boolean"
        ? explicitShowOnProfile || showOnOwnProfile || showOnClubProfile
        : showOnOwnProfile || showOnClubProfile,
    ),
  };
}

export function normalizeSharedEventAlbumVisibility(input: AlbumVisibilityInput = {}) {
  return normalizeAlbumVisibility(input, {
    clubImpliesOwnProfile: true,
    ownFallbackToProfile: true,
  });
}

export function resolveAlbumProfileVisibilityState(
  current: AlbumProfileVisibilityState,
  update: {
    target: "club" | "own";
    value: boolean;
  },
): AlbumProfileVisibilityState {
  if (update.target === "club") {
    if (update.value) {
      return {
        showOnClubProfile: true,
        showOnOwnProfile: true,
      };
    }

    return {
      showOnClubProfile: false,
      showOnOwnProfile: current.showOnOwnProfile,
    };
  }

  if (update.value) {
    return {
      showOnClubProfile: current.showOnClubProfile,
      showOnOwnProfile: true,
    };
  }

  return {
    showOnClubProfile: false,
    showOnOwnProfile: false,
  };
}

function hasUsername(usernames: string[] = [], targetUsername: string) {
  const target = normalize(targetUsername);
  if (!target) return false;
  return usernames.some((item) => normalize(item) === target);
}

export function isFollowing(
  currentUsername: string,
  targetUsername: string,
  followingUsernames: string[] = [],
): boolean {
  const current = normalize(currentUsername);
  const target = normalize(targetUsername);
  if (!current || !target) return false;
  if (current === target) return true;
  return hasUsername(followingUsernames, target);
}

export function isFollowerOf(
  currentUsername: string,
  targetUsername: string,
  targetFollowers: string[] = [],
): boolean {
  const current = normalize(currentUsername);
  const target = normalize(targetUsername);
  if (!current || !target) return false;
  if (current === target) return true;
  return hasUsername(targetFollowers, current);
}

export function resolveFollowsClub(
  currentUsername: string,
  clubUsername: string,
  relations: RelationSnapshot,
) {
  if (typeof relations.followsClub === "boolean") return relations.followsClub;
  return isFollowing(currentUsername, clubUsername, relations.followingUsernames);
}

export function isMembersOnlyEntity(entity: BaseEntity) {
  return (
    entity.visibility === "members_only" ||
    entity.eventVisibility === "members_only" ||
    entity.effectiveVisibility === "members_only"
  );
}

export function resolveFollowsUploader(
  currentUsername: string,
  uploaderUsername: string,
  relations: RelationSnapshot,
) {
  if (typeof relations.followsUploader === "boolean") {
    return relations.followsUploader;
  }
  return isFollowing(currentUsername, uploaderUsername, relations.followingUsernames);
}

export function hasEventCapabilities(entity: BaseEntity) {
  return (
    typeof entity.canDiscoverEvent === "boolean" ||
    typeof entity.canOpenEventDetail === "boolean" ||
    typeof entity.canAttendEvent === "boolean" ||
    typeof entity.canOpenEventAlbum === "boolean"
  );
}

export function hasAlbumCapabilities(entity: BaseEntity) {
  return (
    typeof entity.canDiscoverAlbum === "boolean" ||
    typeof entity.canOpenAlbum === "boolean" ||
    typeof entity.canOpenAlbumEventDetail === "boolean"
  );
}

export function resolveEventEnded(entity: BaseEntity) {
  if (typeof entity.isEndedOrLocked === "boolean") return entity.isEndedOrLocked;

  const endDate = String(entity.endDate || entity.startDate || "").trim();
  if (!endDate) return false;
  const endTime = String(entity.endTime || "23:59").trim() || "23:59";
  const isoLike = `${endDate}T${endTime}:00`;
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
}

export function resolveViewerJoinedEvent(entity: BaseEntity) {
  if (typeof entity.viewerJoinedEvent === "boolean") return entity.viewerJoinedEvent;
  return Boolean(entity.joined);
}
