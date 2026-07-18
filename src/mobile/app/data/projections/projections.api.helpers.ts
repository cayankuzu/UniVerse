import { supabase } from "../../platform/supabase";
import { normalizeAlbumProjectionItem } from "../normalizers/albums";
import { buildEventAlbumCardCountMap } from "../normalizers/albums";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import type { CommentItem } from "../contracts/api";
import { normalizeProjectionEvent } from "../normalizers/events";
import { normalizeImageVariants } from "../normalizers/media";
import { normalizeSearchUserResult } from "../normalizers/searchUsers";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";
import type {
  BlockedUserProjectionItem,
  EventDetailProjection,
  HomeProjectionParams,
  ProjectionHomeFeedItem,
  RelationshipProjectionItem,
  SearchProjectionItem,
  SearchProjectionParams,
} from "./projections.types";
export {
  mapEnvelopeItems,
  normalizeEnvelope,
  nowEnvelope,
  shouldFallbackToLegacy,
  tryProjectionRpc,
} from "./projections.rpc";
import { getProfileCapabilities, resolveProfileIdByUsername } from "../profile/profileLookup";
import { toDisplayName } from "../profile/profileDisplay";
import { timeAgo } from "../../shared/utils/dateTime";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isStudentHomeEvent(item: ProjectionHomeFeedItem) {
  if (item.kind !== "event") return false;
  const actorType = normalize(item.event.feedActorType || item.actor || "");
  return actorType === "student";
}

export function toSearchProjectionItem(
  row: unknown,
  kind: SearchProjectionParams["kind"],
): SearchProjectionItem | null {
  if (kind === "events") return normalizeProjectionEvent(row);
  if (kind === "albums") return normalizeAlbumProjectionItem(row);
  return normalizeSearchUserResult(row);
}

export function toHomeProjectionItem(row: unknown): ProjectionHomeFeedItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id || "").trim();
  const kind = item.kind === "album" ? "album" : item.kind === "event" ? "event" : null;
  if (!id || !kind) return null;
  const actor = item.actor === "student" ? "student" : "club";
  const source = item.source === "own" || item.source === "following" ? item.source : "following";
  const sortDate = String(item.sortDate || item.sort_date || "").trim();

  if (kind === "event") {
    const event = normalizeProjectionEvent(item.event);
    if (!event) return null;
    return {
      actor,
      event,
      id,
      kind,
      sortDate: sortDate || event.createdAt || event.date || "",
      source,
    };
  }

  const album = normalizeAlbumProjectionItem(item.album);
  if (!album) return null;
  return { actor, album, id, kind, sortDate: sortDate || album.createdAt || "", source };
}

export function toEventDetailProjection(row: unknown): EventDetailProjection | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const event = normalizeProjectionEvent(item.event || row);
  if (!event) return null;
  return {
    albumCount:
      typeof item.albumCount === "number"
        ? item.albumCount
        : typeof item.album_count === "number"
          ? Number(item.album_count)
          : Number(event.albumCount || 0),
    event,
    id: String(item.id || event.id || "").trim() || String(event.id || ""),
  };
}

export function toBlockedUserProjectionItem(row: unknown): BlockedUserProjectionItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const userId = String(item.userId || item.user_id || "").trim();
  const username = String(item.username || "").trim();
  if (!userId && !username) return null;
  return {
    accountType:
      item.accountType === "club" ? "club" : item.accountType === "student" ? "student" : undefined,
    blockedAt:
      typeof item.blockedAt === "string"
        ? item.blockedAt
        : typeof item.blocked_at === "string"
          ? item.blocked_at
          : undefined,
    id: userId || username,
    image: String(item.image || item.profileImage || item.profile_image_path || ""),
    imageVariants: normalizeImageVariants(item.imageVariants || item.image_variants),
    isPrivate:
      typeof item.isPrivate === "boolean"
        ? item.isPrivate
        : typeof item.is_private === "boolean"
          ? item.is_private
          : undefined,
    name: String(item.name || username || "Kullanıcı"),
    university: typeof item.university === "string" ? item.university : undefined,
    userId: userId || username,
    username,
  };
}

export function toCommentItem(row: unknown): CommentItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const id = String(item.id || "").trim();
  if (!id) return null;
  const createdAt = String(item.createdAt || item.created_at || new Date().toISOString());
  return {
    createdAt,
    id,
    image: String(item.image || item.profileImage || item.profile_image_path || ""),
    imageVariants: normalizeImageVariants(item.imageVariants || item.image_variants),
    likedByViewer: Boolean(item.likedByViewer ?? item.liked_by_viewer),
    likesCount: Number(item.likesCount || item.likes_count || 0),
    name: String(item.name || item.fromName || item.username || "Kullanıcı"),
    parentId: item.parentId
      ? String(item.parentId)
      : item.parent_id
        ? String(item.parent_id)
        : null,
    text: String(item.text || item.body || ""),
    time: String(item.time || timeAgo(createdAt)),
    university: typeof item.university === "string" ? item.university : undefined,
    userId: String(item.userId || item.user_id || ""),
    username: String(item.username || ""),
  };
}

export function filterLegacyHomeItems(
  items: ProjectionHomeFeedItem[],
  params: HomeProjectionParams,
) {
  const blockedSet = new Set(
    (params.blockedUsernames || []).map((item) => normalize(item)).filter(Boolean),
  );
  const viewerUsername = normalize(params.viewerUsername || "");
  if (viewerUsername) {
    blockedSet.delete(viewerUsername);
  }
  const filtered = items.filter((item) => {
    if (params.typeFilter === "events" && item.kind !== "event") return false;
    if (params.typeFilter === "albums" && item.kind !== "album") return false;
    if (params.sourceFilter === "own" && item.source !== "own") return false;
    if (
      params.sourceFilter === "following" &&
      item.source !== "following" &&
      item.source !== "own"
    ) {
      return false;
    }
    if (params.entityFilter === "clubs" && item.actor !== "club") return false;
    if (params.entityFilter === "students" && item.actor !== "student") return false;
    if (isStudentHomeEvent(item)) return false;

    if (item.kind === "event") {
      return (
        !blockedSet.has(normalize(item.event.clubUsername || "")) &&
        !blockedSet.has(normalize(item.event.feedActorUsername || ""))
      );
    }
    if (viewerUsername && normalize(item.album.username || "") === viewerUsername) {
      return true;
    }
    return (
      !blockedSet.has(normalize(item.album.username || "")) &&
      !blockedSet.has(normalize(item.album.clubUsername || ""))
    );
  });

  filtered.sort((a, b) => {
    const aTime = new Date(a.sortDate).getTime();
    const bTime = new Date(b.sortDate).getTime();
    return params.sortOption === "oldest" ? aTime - bTime : bTime - aTime;
  });
  return filtered;
}

export function buildHomeProjectionItems(params: {
  albums: AlbumPhotoWithMeta[];
  events: EventWithMeta[];
  viewerUsername: string;
}) {
  const viewer = normalize(params.viewerUsername);
  const eventSourceById = new Map<string, ProjectionHomeFeedItem["source"]>();
  const albumCountByEventId = buildEventAlbumCardCountMap(params.albums);

  params.events.forEach((eventItem) => {
    const eventId = String(eventItem.id || "").trim();
    if (!eventId) return;
    if (eventItem.feedSource === "own" || normalize(eventItem.clubUsername || "") === viewer) {
      eventSourceById.set(eventId, "own");
      return;
    }
    eventSourceById.set(eventId, "following");
  });

  const hydratedEvents = params.events.map((eventItem) => {
    const eventId = String(eventItem.id || "").trim();
    const derivedAlbumCount = albumCountByEventId.get(eventId);
    if (typeof derivedAlbumCount !== "number") return eventItem;
    return {
      ...eventItem,
      albumCount: Math.max(Number(eventItem.albumCount || 0), derivedAlbumCount),
    };
  });

  const items: ProjectionHomeFeedItem[] = hydratedEvents.map((eventItem) => ({
    actor: eventItem.feedActorType || "club",
    event: eventItem,
    id: `event:${eventItem.id}`,
    kind: "event",
    sortDate: eventItem.createdAt || eventItem.date || "",
    source: eventSourceById.get(String(eventItem.id || "").trim()) || "following",
  }));

  params.albums.forEach((albumItem) => {
    const relatedEventSource = eventSourceById.get(String(albumItem.eventId || "").trim());
    const uploader = normalize(albumItem.username || "");
    const clubUsername = normalize(albumItem.clubUsername || "");
    const isOwn = uploader === viewer;

    items.push({
      actor: uploader && uploader === clubUsername ? "club" : "student",
      album: albumItem,
      id: `album:${albumItem.id}`,
      kind: "album",
      sortDate: albumItem.createdAt || "",
      source: isOwn ? "own" : relatedEventSource === "own" ? "own" : "following",
    });
  });

  return items;
}

export async function fetchRelationshipRows(
  username: string,
  kind: "followers" | "following",
): Promise<RelationshipProjectionItem[]> {
  const targetUserId = await resolveProfileIdByUsername(username);
  if (!targetUserId) return [];

  const capabilities = await getProfileCapabilities(targetUserId);
  if (kind === "followers" && capabilities && !capabilities.canViewFollowers) return [];
  if (kind === "following" && capabilities && !capabilities.canViewFollowing) return [];

  const idColumn = kind === "followers" ? "follower_id" : "following_id";
  const targetColumn = kind === "followers" ? "following_id" : "follower_id";
  const { data: rows, error } = await supabase
    .from("follows")
    .select(`${idColumn},created_at`)
    .eq(targetColumn, targetUserId)
    .eq("status", "accepted")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(rows) || rows.length === 0) return [];

  const ids = rows
    .map((row) => String(row[idColumn as keyof typeof row] || "").trim())
    .filter(Boolean);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id,username,name,club_name,profile_image_path,cover_image_path,account_type,university,is_private,department,grade_year,categories,bio,description",
    )
    .in("user_id", ids);

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerFollowMap = new Map<string, "none" | "requested" | "following">();
  if (viewer?.id && ids.length > 0) {
    const { data: viewerRows } = await supabase
      .from("follows")
      .select("following_id,status")
      .eq("follower_id", viewer.id)
      .is("deleted_at", null)
      .in("following_id", ids);
    (viewerRows || []).forEach((row) => {
      const followingId = String(row.following_id || "").trim();
      if (!followingId) return;
      viewerFollowMap.set(
        followingId,
        row.status === "accepted" ? "following" : row.status === "pending" ? "requested" : "none",
      );
    });
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [String(profile.user_id || "").trim(), profile]),
  );
  return rows
    .map((row): RelationshipProjectionItem | null => {
      const profile = profileMap.get(String(row[idColumn as keyof typeof row] || "").trim());
      if (!profile) return null;
      return {
        accountType: profile.account_type === "club" ? "club" : "student",
        bio: profile.bio || undefined,
        categories: Array.isArray(profile.categories) ? profile.categories : undefined,
        category: Array.isArray(profile.categories) ? profile.categories[0] : undefined,
        coverImage: profile.cover_image_path || "",
        department: profile.department || undefined,
        description: profile.description || undefined,
        id: String(profile.user_id || profile.username || ""),
        image: profile.profile_image_path || "",
        isPrivate: resolveProfilePrivacy(profile.account_type, profile.is_private),
        name: toDisplayName(profile),
        time: timeAgo(String(row.created_at || "")),
        university: profile.university || "",
        username: profile.username || "",
        year: profile.grade_year || undefined,
        viewerFollowStatus: viewerFollowMap.get(String(profile.user_id || "").trim()) || "none",
      };
    })
    .filter((item): item is RelationshipProjectionItem => Boolean(item));
}
