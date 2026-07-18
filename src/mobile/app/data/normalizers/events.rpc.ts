import type { EventWithMeta } from "../contracts/content";
import { normalizeImageVariants } from "./media";
import { resolveEventAttendeesCount } from "../content/events/events.attendeeCount";

export interface EventProjectionRpcRow {
  id: string;
  club_user_id: string;
  club_username: string;
  club_name: string;
  club_image: string | null;
  university: string;
  title: string;
  description: string;
  cover_image_path: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string;
  address: string;
  event_type: string;
  category: string;
  categories: string[] | null;
  fee_label: string;
  access_label: string;
  capacity: number | null;
  target_audience: string | null;
  level: string | null;
  materials: string | null;
  visibility: "public" | "members_only";
  created_at: string;
  likes_count: number;
  liked: boolean;
  attendees_count: number;
  joined: boolean;
  comments_count?: number | null;
  club_is_private: boolean;
  effective_visibility: "public" | "followers_only" | "members_only";
  discoverable?: boolean | null;
  openable?: boolean | null;
  joinable?: boolean | null;
  attendees_viewable?: boolean | null;
  album_openable?: boolean | null;
  album_uploadable?: boolean | null;
  ended?: boolean | null;
  locked_reason_code?: string | null;
  locked_reason_text?: string | null;
  feed_actor_type?: "club" | "student" | null;
  feed_actor_username?: string | null;
  feed_source?: "own" | "following_club" | "following_student" | null;
  album_count?: number | null;
  albumCount?: number | null;
}

export function mapEventProjectionRow(row: EventProjectionRpcRow): EventWithMeta {
  return {
    id: row.id,
    clubUserId: row.club_user_id,
    clubUsername: row.club_username,
    club: row.club_name,
    clubImage: row.club_image || "",
    university: row.university,
    title: row.title,
    description: row.description,
    image: row.cover_image_path || "",
    imageVariants: normalizeImageVariants(
      (row as EventProjectionRpcRow & { image_variants?: unknown }).image_variants,
    ),
    date: row.starts_at.slice(0, 10),
    startDate: row.starts_at.slice(0, 10),
    endDate: row.ends_at.slice(0, 10),
    startTime: row.starts_at.slice(11, 16),
    endTime: row.ends_at.slice(11, 16),
    location: row.location_name,
    address: row.address,
    type: row.event_type,
    category: row.category,
    categories: row.categories || [],
    fee: row.fee_label,
    access: row.access_label,
    capacity: row.capacity || 0,
    targetAudience: row.target_audience || "",
    level: row.level || "",
    materials: row.materials || "",
    visibility: row.visibility,
    createdAt: row.created_at,
    likes: Number(row.likes_count || 0),
    liked: Boolean(row.liked),
    joined: Boolean(row.joined),
    attendees: resolveEventAttendeesCount(row.attendees_count, row.joined),
    comments: Number(row.comments_count || 0),
    clubIsPrivate: Boolean(row.club_is_private),
    effectiveVisibility: row.effective_visibility,
    canDiscoverEvent: typeof row.discoverable === "boolean" ? row.discoverable : undefined,
    canOpenEventDetail: typeof row.openable === "boolean" ? row.openable : undefined,
    canAttendEvent: typeof row.joinable === "boolean" ? row.joinable : undefined,
    canViewAttendees:
      typeof row.attendees_viewable === "boolean" ? row.attendees_viewable : undefined,
    canOpenEventAlbum: typeof row.album_openable === "boolean" ? row.album_openable : undefined,
    canUploadEventAlbum:
      typeof row.album_uploadable === "boolean" ? row.album_uploadable : undefined,
    isEndedOrLocked: typeof row.ended === "boolean" ? row.ended : undefined,
    albumCount:
      typeof row.albumCount === "number"
        ? Number(row.albumCount)
        : typeof row.album_count === "number"
          ? Number(row.album_count)
          : undefined,
    lockedReasonCode: row.locked_reason_code || undefined,
    lockedReasonText: row.locked_reason_text || undefined,
    feedActorType: row.feed_actor_type || undefined,
    feedActorUsername: row.feed_actor_username || undefined,
    feedSource: row.feed_source || undefined,
  };
}
