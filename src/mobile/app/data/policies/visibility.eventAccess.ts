import type {
  EventAccessResult,
  EventActionAccess,
  BaseEntity,
  RelationSnapshot,
} from "./visibility.shared";
import {
  hasEventCapabilities,
  isMembersOnlyEntity,
  normalize,
  resolveEventEnded,
  resolveFollowsClub,
} from "./visibility.shared";

function resolveClubIsPrivate(entity: BaseEntity, relations: RelationSnapshot) {
  if (typeof relations.clubIsPrivate === "boolean") return relations.clubIsPrivate;
  return Boolean(entity.clubIsPrivate);
}

export function canViewEvent(
  currentUsername: string,
  event: BaseEntity,
  relations: RelationSnapshot = {},
): EventAccessResult {
  const clubUsername = normalize(event.clubUsername || "");
  const current = normalize(currentUsername);
  const clubIsPrivate = resolveClubIsPrivate(event, relations);
  const isOwnClub = Boolean(clubUsername) && current === clubUsername;
  const followsClub = clubUsername ? resolveFollowsClub(current, clubUsername, relations) : false;

  if (hasEventCapabilities(event)) {
    const canView = Boolean(event.canDiscoverEvent ?? event.canOpenEventDetail);
    return {
      canView,
      reason: canView
        ? undefined
        : event.lockedReasonText || "Bu kulübün içeriğini gormek icin kulübü takip etmelisiniz.",
    };
  }

  if (!clubIsPrivate) {
    return { canView: true };
  }

  const canView = isOwnClub || followsClub;
  return {
    canView,
    reason: canView ? undefined : "Bu kulübün içeriğini gormek icin kulübü takip etmelisiniz.",
  };
}

export function getEventActionAccess(
  currentUsername: string,
  event: BaseEntity,
  relations: RelationSnapshot = {},
): EventActionAccess {
  if (hasEventCapabilities(event)) {
    const reason = event.lockedReasonText || undefined;
    const reasonCode = event.lockedReasonCode || undefined;
    const canOpenDetail = Boolean(event.canOpenEventDetail ?? event.canDiscoverEvent);
    const canJoin = Boolean(event.canAttendEvent);
    const canViewAttendees = Boolean(event.canViewAttendees ?? canOpenDetail);
    const canOpenAlbum = Boolean(event.canOpenEventAlbum ?? canOpenDetail);
    const isEnded =
      typeof event.isEndedOrLocked === "boolean" ? event.isEndedOrLocked : resolveEventEnded(event);
    const isOwnClub = normalize(currentUsername) === normalize(event.clubUsername || "");
    const viewerJoined = Boolean(event.joined);
    const canUploadAlbum =
      typeof event.canUploadEventAlbum === "boolean"
        ? event.canUploadEventAlbum
        : viewerJoined || isOwnClub;
    const isMembersOnly = isMembersOnlyEntity(event);

    return {
      canJoin,
      canViewAttendees,
      canOpenDetail,
      canOpenAlbum,
      canUploadAlbum,
      isMembersOnly,
      isEligible: canOpenDetail || canJoin || canOpenAlbum || canUploadAlbum,
      isOwnClub,
      isEnded,
      reason,
      reasonCode,
      joinReason: !canJoin ? reason : undefined,
      joinReasonCode: !canJoin ? reasonCode : undefined,
      attendeesReason: !canViewAttendees ? reason : undefined,
      attendeesReasonCode: !canViewAttendees ? reasonCode : undefined,
      albumReason: !canOpenAlbum ? reason : undefined,
      albumReasonCode: !canOpenAlbum ? reasonCode : undefined,
      uploadReason: !canUploadAlbum ? reason : undefined,
      uploadReasonCode: !canUploadAlbum ? reasonCode : undefined,
    };
  }

  const clubUsername = normalize(event.clubUsername || "");
  const current = normalize(currentUsername);
  const clubIsPrivate = resolveClubIsPrivate(event, relations);
  const eventIsMembersOnly = isMembersOnlyEntity(event);
  const followsClub = resolveFollowsClub(current, clubUsername, relations);
  const isOwnClub = current === clubUsername;
  const viewerJoined = Boolean(event.joined);
  const isEnded = resolveEventEnded(event);
  const canOpenDetail = isOwnClub || viewerJoined || (clubIsPrivate ? followsClub : true);
  const canJoin = canOpenDetail && !isEnded && !isOwnClub && (!eventIsMembersOnly || viewerJoined);
  const canViewAttendees = canOpenDetail && (!eventIsMembersOnly || isOwnClub || viewerJoined);
  const canOpenAlbum = canOpenDetail && (!eventIsMembersOnly || isOwnClub || viewerJoined);
  const canUploadAlbum = viewerJoined || isOwnClub;
  const reason = !canOpenDetail
    ? "Bu etkinliği görmek için kulübü takip etmelisiniz."
    : eventIsMembersOnly && !isOwnClub && !viewerJoined
      ? "Bu etkinlik sadece takipcilere Özeldir."
      : isEnded
        ? "Etkinlik sona erdi."
        : undefined;
  const reasonCode = !canOpenDetail
    ? "FOLLOW_REQUIRED"
    : eventIsMembersOnly && !isOwnClub && !viewerJoined
      ? "FOLLOW_REQUIRED"
      : isEnded
        ? "EVENT_ENDED"
        : undefined;

  return {
    canJoin,
    canViewAttendees,
    canOpenDetail,
    canOpenAlbum,
    canUploadAlbum,
    isMembersOnly: eventIsMembersOnly,
    isEligible: canOpenDetail || canJoin || canOpenAlbum || canUploadAlbum,
    isOwnClub,
    isEnded,
    reason,
    reasonCode,
    joinReason: !canJoin ? reason : undefined,
    joinReasonCode: !canJoin ? reasonCode : undefined,
    attendeesReason: !canViewAttendees ? reason : undefined,
    attendeesReasonCode: !canViewAttendees ? reasonCode : undefined,
    albumReason: !canOpenAlbum ? reason : undefined,
    albumReasonCode: !canOpenAlbum ? reasonCode : undefined,
    uploadReason: !canUploadAlbum ? reason : undefined,
    uploadReasonCode: !canUploadAlbum ? reasonCode : undefined,
  };
}
