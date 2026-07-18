import type { EventWithMeta } from "../contracts/content";

export { hasEventRpcShape, isEventProjectionLike } from "./events.shapes";
export { mapEventProjectionRow, type EventProjectionRpcRow } from "./events.rpc";

import { hasEventRpcShape, isEventProjectionLike } from "./events.shapes";
import { mapEventProjectionRow, type EventProjectionRpcRow } from "./events.rpc";
import { normalizeImageVariants } from "./media";
import { resolveEventAttendeesCount } from "../content/events/events.attendeeCount";

export function normalizeProjectionEvent(row: unknown): EventWithMeta | null {
  if (!row || typeof row !== "object") return null;

  const item = row as Record<string, unknown>;
  if (!isEventProjectionLike(item)) return null;

  if (hasEventRpcShape(item)) {
    return mapEventProjectionRow(item as unknown as EventProjectionRpcRow);
  }

  const id = String(item.id || "").trim();
  if (!id) return null;

  return {
    id,
    clubUserId: String(item.clubUserId || item.club_user_id || ""),
    clubUsername: String(item.clubUsername || item.club_username || ""),
    club: String(item.club || item.clubName || item.club_name || ""),
    clubImage: String(item.clubImage || item.club_image || ""),
    university: String(item.university || ""),
    title: String(item.title || ""),
    description: String(item.description || ""),
    image: String(item.image || item.coverImage || item.cover_image_path || ""),
    imageVariants: normalizeImageVariants(item.imageVariants || item.image_variants),
    date: String(item.date || item.startDate || item.start_date || ""),
    startDate: String(item.startDate || item.start_date || item.date || ""),
    endDate: String(item.endDate || item.end_date || item.date || ""),
    startTime: String(item.startTime || item.start_time || ""),
    endTime: String(item.endTime || item.end_time || ""),
    location: String(item.location || item.location_name || ""),
    address: String(item.address || ""),
    type: String(item.type || item.event_type || ""),
    category: String(item.category || ""),
    categories: Array.isArray(item.categories) ? (item.categories as string[]) : [],
    fee: String(item.fee || item.fee_label || ""),
    access: String(item.access || item.access_label || ""),
    capacity: Number(item.capacity || 0),
    targetAudience: String(item.targetAudience || item.target_audience || ""),
    level: String(item.level || ""),
    materials: String(item.materials || ""),
    visibility: (item.visibility === "members_only" ? "members_only" : "public") as
      "public" | "members_only",
    createdAt: String(item.createdAt || item.created_at || ""),
    likes: Number(item.likes || item.likes_count || 0),
    liked: Boolean(item.liked),
    joined: Boolean(item.joined),
    attendees: resolveEventAttendeesCount(item.attendees || item.attendees_count, item.joined),
    comments: Number(item.comments || item.comments_count || 0),
    clubIsPrivate:
      typeof item.clubIsPrivate === "boolean"
        ? item.clubIsPrivate
        : typeof item.club_is_private === "boolean"
          ? item.club_is_private
          : false,
    effectiveVisibility: (String(
      item.effectiveVisibility || item.effective_visibility || "public",
    ) || "public") as "public" | "followers_only" | "members_only",
    canDiscoverEvent:
      typeof item.canDiscoverEvent === "boolean" ? item.canDiscoverEvent : undefined,
    canOpenEventDetail:
      typeof item.canOpenEventDetail === "boolean" ? item.canOpenEventDetail : undefined,
    canAttendEvent: typeof item.canAttendEvent === "boolean" ? item.canAttendEvent : undefined,
    canViewAttendees:
      typeof item.canViewAttendees === "boolean" ? item.canViewAttendees : undefined,
    canOpenEventAlbum:
      typeof item.canOpenEventAlbum === "boolean" ? item.canOpenEventAlbum : undefined,
    canUploadEventAlbum:
      typeof item.canUploadEventAlbum === "boolean" ? item.canUploadEventAlbum : undefined,
    isEndedOrLocked: typeof item.isEndedOrLocked === "boolean" ? item.isEndedOrLocked : undefined,
    albumCount:
      typeof item.albumCount === "number"
        ? item.albumCount
        : typeof item.album_count === "number"
          ? Number(item.album_count)
          : undefined,
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
    feedActorType:
      item.feedActorType === "student"
        ? "student"
        : item.feedActorType === "club"
          ? "club"
          : item.feed_actor_type === "student"
            ? "student"
            : item.feed_actor_type === "club"
              ? "club"
              : undefined,
    feedActorUsername:
      typeof item.feedActorUsername === "string"
        ? item.feedActorUsername
        : typeof item.feed_actor_username === "string"
          ? item.feed_actor_username
          : undefined,
    feedSource:
      item.feedSource === "own" ||
      item.feedSource === "following_club" ||
      item.feedSource === "following_student"
        ? item.feedSource
        : item.feed_source === "own" ||
            item.feed_source === "following_club" ||
            item.feed_source === "following_student"
          ? item.feed_source
          : undefined,
  };
}
