type ProfileFollowStatus = "none" | "requested" | "following";

function normalizeUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolveProfileTabState(params: {
  albumsLength: number;
  eventsLength: number;
  profile:
    | {
        albumsCount?: number;
        eventsCount?: number;
      }
    | null
    | undefined;
}) {
  return {
    tabCounts: {
      albums: params.albumsLength || Number(params.profile?.albumsCount || 0),
      events: params.eventsLength || Number(params.profile?.eventsCount || 0),
    },
  };
}

export function resolveProfileLockState(params: {
  canViewContent: boolean;
  isOwnProfile: boolean;
  profile: { accountType?: "student" | "club"; isPrivate?: boolean } | null | undefined;
  lockedReasonText?: string | null;
}) {
  const contentLockedMessage =
    params.lockedReasonText ||
    "İçerikleri görebilmek için takip isteğinizin kabul edilmesi gerekiyor.";
  const showPrivateNotice = Boolean(
    params.profile?.isPrivate && !params.canViewContent && !params.isOwnProfile,
  );

  return {
    contentLockedMessage,
    showPrivateNotice,
    privateNoticeText:
      params.lockedReasonText || "Bu hesap gizlidir. Takip edilmediği sürece içerikler açılmaz.",
  };
}

export function normalizeDisplayProfileFollowStatus(params: {
  accountType?: "club" | "student" | null;
  followStatus: ProfileFollowStatus;
}) {
  if (params.accountType === "club" && params.followStatus === "requested") {
    return "none" as const;
  }
  return params.followStatus;
}

export function resolveRelationshipBackedProfileFollowStatus(params: {
  followStatusFromProjection: ProfileFollowStatus;
  relationshipSnapshot:
    | {
        followingUsernames?: string[] | null;
      }
    | null
    | undefined;
  targetUsername?: string | null;
}) {
  const targetUsername = normalizeUsername(params.targetUsername);
  if (!targetUsername || !params.relationshipSnapshot) {
    return null;
  }

  const followingUsernames = new Set(
    (params.relationshipSnapshot.followingUsernames || [])
      .map((item) => normalizeUsername(item))
      .filter(Boolean),
  );
  if (followingUsernames.has(targetUsername)) {
    return "following" as const;
  }

  return params.followStatusFromProjection === "requested" ? "requested" : "none";
}

export function resolveProfileFollowStatus(params: {
  followStatusFromProjection: ProfileFollowStatus;
  followStatusFromDirect: ProfileFollowStatus | null;
  optimisticFollowStatus: ProfileFollowStatus | null;
}) {
  if (params.optimisticFollowStatus !== null) {
    return params.optimisticFollowStatus;
  }

  if (params.followStatusFromDirect !== null) {
    return params.followStatusFromDirect;
  }

  return params.followStatusFromProjection;
}

export function resolveEffectiveProfileFollowStatus(params: {
  allowCapabilityOverride?: boolean;
  capabilityCanViewContent: boolean;
  followStatus: ProfileFollowStatus;
  isOwnProfile: boolean;
  profile: { isPrivate?: boolean } | null | undefined;
}) {
  const allowCapabilityOverride =
    params.allowCapabilityOverride === undefined ? true : params.allowCapabilityOverride;

  if (
    allowCapabilityOverride &&
    params.followStatus === "none" &&
    !params.isOwnProfile &&
    Boolean(params.profile?.isPrivate) &&
    params.capabilityCanViewContent
  ) {
    return "following" as const;
  }

  return params.followStatus;
}

export function resolveProfileContentAccess(params: {
  capabilityCanViewContent: boolean;
  followStatus: ProfileFollowStatus;
  hasAuthoritativeFollowStatus?: boolean;
  isOwnProfile: boolean;
  profile: { isPrivate?: boolean } | null | undefined;
}) {
  if (!params.profile) return false;
  if (params.isOwnProfile) return true;
  if (!params.profile.isPrivate) return true;
  if (params.followStatus === "following") return true;
  if (params.hasAuthoritativeFollowStatus) return false;
  return params.capabilityCanViewContent;
}
