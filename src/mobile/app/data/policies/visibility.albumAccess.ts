import type {
  AlbumAccessResult,
  AlbumButtonAction,
  BaseEntity,
  RelationSnapshot,
} from "./visibility.shared";
import {
  hasAlbumCapabilities,
  normalize,
  normalizeAlbumVisibility,
  resolveFollowsClub,
  resolveFollowsUploader,
  resolveViewerJoinedEvent,
} from "./visibility.shared";

function resolveClubIsPrivate(entity: BaseEntity, relations: RelationSnapshot) {
  if (typeof relations.clubIsPrivate === "boolean") return relations.clubIsPrivate;
  return Boolean(entity.clubIsPrivate);
}

function resolveAlbumBlockedReason(clubIsPrivate: boolean, album: BaseEntity) {
  return (
    album.lockedReasonText ||
    (clubIsPrivate
      ? "Bu kulübün albumunu gormek icin kulübü takip etmelisiniz."
      : "Bu albümü gormek icin kullanıcıy? takip etmelisiniz.")
  );
}

export function canViewAlbum(
  currentUsername: string,
  album: BaseEntity,
  context: "feed" | "search" | "profile" | "event_album" = "feed",
  relations: RelationSnapshot = {},
): AlbumAccessResult {
  const clubUsername = normalize(album.clubUsername || "");
  const uploaderUsername = normalize(album.username || "");
  const current = normalize(currentUsername);
  const clubIsPrivate = resolveClubIsPrivate(album, relations);
  const uploaderIsPrivate =
    typeof relations.uploaderIsPrivate === "boolean"
      ? relations.uploaderIsPrivate
      : Boolean(album.uploaderIsPrivate);
  const isOwnClub = Boolean(clubUsername) && current === clubUsername;
  const isOwnAlbum = Boolean(uploaderUsername) && current === uploaderUsername;
  const viewerJoined = resolveViewerJoinedEvent(album);
  const followsClub = clubUsername ? resolveFollowsClub(current, clubUsername, relations) : false;
  const followsUploader = uploaderUsername
    ? resolveFollowsUploader(current, uploaderUsername, relations)
    : false;
  const visibility = normalizeAlbumVisibility(album, { ownFallbackToProfile: true });
  const canAccessEventScope = !clubIsPrivate || isOwnClub || viewerJoined || followsClub;

  if (isOwnAlbum || isOwnClub) {
    return { canView: true };
  }

  if (hasAlbumCapabilities(album)) {
    if (context === "event_album") {
      const canView = Boolean(album.canOpenAlbum ?? album.canDiscoverAlbum);
      return {
        canView,
        reason: canView ? undefined : "Bu album etkinlik albumunde gösterilmiyor.",
      };
    }

    const canView = Boolean(
      album.canDiscoverAlbum ?? album.canOpenAlbum ?? album.canOpenAlbumEventDetail,
    );
    return {
      canView,
      reason: canView ? undefined : resolveAlbumBlockedReason(clubIsPrivate, album),
    };
  }

  if (context === "search") {
    const canView =
      !clubIsPrivate &&
      !uploaderIsPrivate &&
      Boolean(visibility.showOnOwnProfile || visibility.showOnClubProfile);
    return {
      canView,
      reason: canView ? undefined : "Gizli hesap albumleri arama listesinde gösterilmez.",
    };
  }

  if (!clubIsPrivate && !uploaderIsPrivate) {
    return { canView: true };
  }

  if (context === "event_album") {
    const canView = Boolean(
      canAccessEventScope &&
      (visibility.showOnClubProfile || (!uploaderIsPrivate && visibility.showOnOwnProfile)),
    );
    return {
      canView,
      reason: canView ? undefined : "Bu album etkinlik albumunde gösterilmiyor.",
    };
  }

  if (clubIsPrivate) {
    const canView = Boolean(
      isOwnClub ||
      (visibility.showOnClubProfile && followsClub) ||
      (visibility.showOnOwnProfile &&
        (!uploaderIsPrivate || isOwnAlbum || followsUploader) &&
        (followsClub || isOwnAlbum)),
    );
    return {
      canView,
      reason: canView ? undefined : "Bu kulübün albumunu gormek icin kulübü takip etmelisiniz.",
    };
  }

  const canView = Boolean(
    visibility.showOnClubProfile || !uploaderIsPrivate || isOwnAlbum || followsUploader,
  );
  return {
    canView,
    reason: canView ? undefined : "Bu albümü gormek icin kullanıcıy? takip etmelisiniz.",
  };
}

export function getAlbumButtonAction(
  currentUsername: string,
  album: BaseEntity,
  relations: RelationSnapshot = {},
  context: "feed" | "search" | "profile" | "event_album" = "feed",
): {
  action: AlbumButtonAction;
  label: string;
  navigateTo?: string;
  message?: string;
} {
  if (context === "event_album") {
    return { action: "disabled", label: "Etkinlik Albümü" };
  }

  const clubUsername = normalize(album.clubUsername || "");
  const uploaderUsername = normalize(album.username || "");
  const current = normalize(currentUsername);
  const removedEvent = normalize(album.lockedReasonCode || "") === "event_removed";

  if (removedEvent) {
    return {
      action: "disabled",
      label: "Etkinligi Gor",
      message: album.lockedReasonText || "Bu albümün bagli oldugu etkinlik artik mevcut degil.",
    };
  }

  const followsClub = resolveFollowsClub(current, clubUsername, relations);
  const isOwnClub = current === clubUsername;
  const isOwnAlbum = current === uploaderUsername;
  const viewerJoined = resolveViewerJoinedEvent(album);
  const canOpenEventDetail =
    isOwnClub || isOwnAlbum || viewerJoined || followsClub || !clubUsername;

  if (album.eventId || hasAlbumCapabilities(album) || canOpenEventDetail) {
    return {
      action: "view_event",
      label: "Etkinligi Gor",
      navigateTo: album.eventId ? `/album/${album.eventId}` : undefined,
    };
  }

  return {
    action: clubUsername ? "view_club" : "disabled",
    label: clubUsername ? "Kulübü Gor" : "Etkinligi Gor",
    navigateTo: clubUsername ? `/profile/${clubUsername}` : undefined,
    message: "Bu etkinlik sadece takipcilere Özeldir. Kulübü takip ederek gorebilirsiniz.",
  };
}
