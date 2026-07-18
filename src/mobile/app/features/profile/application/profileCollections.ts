import type {
  ProjectionHomeFeedItem,
  ProfileContentTab,
} from "../../../data/projections/projections.types";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { UserProfile } from "../../../data/contracts/entities";
import {
  buildEventAlbumCardCountMap,
  mergeAlbumCollections,
  normalizeAlbumProjectionItem,
} from "../../../data/normalizers/albums";
import { normalizeProjectionEvent } from "../../../data/normalizers/events";
import type { AlbumOwnerFilter } from "../domain/profileConstants";
import { normalizeProfileValue } from "../domain/viewProfile.helpers";

type UsernameLike = {
  username?: string;
};

export function createBlockedProfileSet(blockedUsers: string[]) {
  return new Set(blockedUsers.map((item) => normalizeProfileValue(item)).filter(Boolean));
}

export function createBlockedProfileSetExcludingSelf(
  blockedUsers: string[],
  selfUsername?: string,
) {
  const blockedSet = createBlockedProfileSet(blockedUsers);
  const normalizedSelf = normalizeProfileValue(selfUsername || "");
  if (normalizedSelf) {
    blockedSet.delete(normalizedSelf);
  }
  return blockedSet;
}

export function filterBlockedProfileEvents(events: EventWithMeta[], blockedSet: Set<string>) {
  return events.filter((item) => !blockedSet.has(normalizeProfileValue(item.clubUsername || "")));
}

export function filterBlockedProfileAlbums(
  albums: AlbumPhotoWithMeta[],
  blockedSet: Set<string>,
  params?: {
    isOwnProfile?: boolean;
    ownerUserId?: string;
    ownerUsername?: string;
    profile?: UserProfile | null | undefined;
  },
) {
  return albums.filter((item) => {
    const clubUsername = normalizeProfileValue(item.clubUsername || "");
    const uploaderUsername = normalizeProfileValue(item.username || "");
    const preserveOwnProfileAlbum = Boolean(
      params?.isOwnProfile &&
      albumBelongsToProfileOwner(item, params?.profile, params?.ownerUsername, params?.ownerUserId),
    );

    if (preserveOwnProfileAlbum) {
      return true;
    }

    return !(blockedSet.has(clubUsername) || blockedSet.has(uploaderUsername));
  });
}

export function filterBlockedProfileUsers<T extends UsernameLike>(
  items: T[],
  blockedSet: Set<string>,
) {
  return items.filter((item) => !blockedSet.has(normalizeProfileValue(item.username || "")));
}

export function splitHomeProjectionItems(items: ProjectionHomeFeedItem[]) {
  const albums: AlbumPhotoWithMeta[] = [];
  const events: EventWithMeta[] = [];
  items.forEach((item) => {
    if (item.kind === "album" && item.album) albums.push(item.album);
    if (item.kind === "event" && item.event) events.push(item.event);
  });
  return { albums, events };
}

export function sanitizeProfileEvents(items: unknown[]) {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const normalizedEvent = normalizeProjectionEvent(row.event || row);
      if (!normalizedEvent) return null;
      const topLevelAlbumCount =
        typeof row.albumCount === "number"
          ? row.albumCount
          : typeof row.album_count === "number"
            ? Number(row.album_count)
            : null;
      if (typeof topLevelAlbumCount !== "number") {
        return normalizedEvent;
      }
      return {
        ...normalizedEvent,
        albumCount: Math.max(Number(normalizedEvent.albumCount || 0), topLevelAlbumCount),
      };
    })
    .filter((item): item is EventWithMeta => Boolean(item));
}

export function sanitizeProfileAlbums(items: unknown[]) {
  return items
    .map((item) => normalizeAlbumProjectionItem(item))
    .filter((item): item is AlbumPhotoWithMeta => Boolean(item));
}

function resolveProfileAlbumOwnerName(profile: UserProfile) {
  if (profile.accountType === "club") {
    return String(profile.clubName || profile.name || profile.username || "").trim();
  }
  return String(profile.name || profile.username || "").trim();
}

function albumBelongsToProfileOwner(
  album: AlbumPhotoWithMeta,
  profile: UserProfile | null | undefined,
  ownerUsername?: string,
  ownerUserId?: string,
) {
  const normalizedOwnerUsername = normalizeProfileValue(profile?.username || ownerUsername || "");
  const normalizedOwnerUserId = String(profile?.id || ownerUserId || "").trim();

  if (profile?.accountType === "club") {
    return isClubOwnedAlbum(album, normalizedOwnerUsername, normalizedOwnerUserId);
  }

  const uploaderId = String(album.userId || "").trim();
  if (normalizedOwnerUserId && uploaderId) {
    return normalizedOwnerUserId === uploaderId;
  }

  const uploaderUsername = normalizeProfileValue(album.username || "");
  if (normalizedOwnerUsername && uploaderUsername) {
    return normalizedOwnerUsername === uploaderUsername;
  }

  return Boolean(profile);
}

export function hydrateProfileOwnedAlbums(
  albums: AlbumPhotoWithMeta[],
  profile: UserProfile | null | undefined,
  ownerUsername?: string,
  ownerUserId?: string,
) {
  if (!profile) return albums;

  const resolvedOwnerUserId = String(profile.id || ownerUserId || "").trim();
  const resolvedUsername = String(profile.username || ownerUsername || "").trim();
  const resolvedOwnerName = resolveProfileAlbumOwnerName(profile);
  const resolvedProfileImage = String(profile.profileImage || "").trim();
  const resolvedUniversity = String(profile.university || "").trim();
  const resolvedClubName = String(
    profile.clubName || profile.name || profile.username || "",
  ).trim();

  return albums.map((album) => {
    if (!albumBelongsToProfileOwner(album, profile, resolvedUsername, resolvedOwnerUserId)) {
      return album;
    }

    return {
      ...album,
      userId: resolvedOwnerUserId || album.userId,
      username: resolvedUsername || album.username,
      name: resolvedOwnerName || album.name || album.username,
      userImage: resolvedProfileImage || album.userImage,
      userUniversity: resolvedUniversity || album.userUniversity,
      ...(resolvedUniversity ? { university: resolvedUniversity } : {}),
      ...(profile.accountType === "club"
        ? {
            clubName: resolvedClubName || album.clubName,
            clubUserId: resolvedOwnerUserId || album.clubUserId,
            clubUsername: resolvedUsername || album.clubUsername,
          }
        : {}),
    };
  });
}

export function hydrateEventsWithAlbumCounts(
  events: EventWithMeta[],
  albums: AlbumPhotoWithMeta[],
) {
  const countMap = buildEventAlbumCardCountMap(albums);

  return events.map((event) => ({
    ...event,
    albumCount: Math.max(
      Number(event.albumCount || 0),
      countMap.get(String(event.id || "").trim()) || 0,
    ),
  }));
}

export function sortProfileEvents(events: EventWithMeta[]) {
  const next = [...events];
  next.sort((a, b) => {
    const aTime = new Date(a.createdAt || a.date || a.startDate || "").getTime();
    const bTime = new Date(b.createdAt || b.date || b.startDate || "").getTime();
    return bTime - aTime;
  });
  return next;
}

export function sortProfileAlbums(albums: AlbumPhotoWithMeta[]) {
  const next = mergeAlbumCollections(albums);
  next.sort((a, b) => {
    const aTime = new Date(a.createdAt || "").getTime();
    const bTime = new Date(b.createdAt || "").getTime();
    return bTime - aTime;
  });
  return next;
}

export function buildProfileOwnedEventIdSet(
  events: EventWithMeta[],
  ownerUsername?: string,
  ownerUserId?: string,
) {
  const normalizedOwnerUsername = normalizeProfileValue(ownerUsername || "");
  const normalizedOwnerUserId = String(ownerUserId || "").trim();
  const ids = new Set<string>();

  events.forEach((event) => {
    const eventId = String(event.id || "").trim();
    if (!eventId) return;
    const clubUsername = normalizeProfileValue(event.clubUsername || "");
    const clubUserId = String(event.clubUserId || "").trim();
    if (
      (normalizedOwnerUsername && clubUsername === normalizedOwnerUsername) ||
      (normalizedOwnerUserId && clubUserId === normalizedOwnerUserId)
    ) {
      ids.add(eventId);
    }
  });

  return ids;
}

export function eventMatchesProfileScope(
  event: EventWithMeta,
  ownerUsername?: string,
  ownerUserId?: string,
  ownedEventIds?: Set<string>,
) {
  const normalizedOwnerUsername = normalizeProfileValue(ownerUsername || "");
  const normalizedOwnerUserId = String(ownerUserId || "").trim();
  const clubUsername = normalizeProfileValue(event.clubUsername || "");
  const clubUserId = String(event.clubUserId || "").trim();
  const eventId = String(event.id || "").trim();

  if (normalizedOwnerUsername && clubUsername === normalizedOwnerUsername) return true;
  if (normalizedOwnerUserId && clubUserId === normalizedOwnerUserId) return true;
  if (eventId && ownedEventIds?.has(eventId)) return true;
  return false;
}

export function mergeScopedProfileEvents(params: {
  sourceEvents: EventWithMeta[];
  cachedHomeEvents: EventWithMeta[];
  ownerUsername?: string;
  ownerUserId?: string;
  ownedEventIds?: Set<string>;
}) {
  const matchedHomeEvents = params.cachedHomeEvents.filter((item) =>
    eventMatchesProfileScope(item, params.ownerUsername, params.ownerUserId, params.ownedEventIds),
  );
  const byId = new Map<string, EventWithMeta>();
  [...params.sourceEvents, ...matchedHomeEvents].forEach((item) => {
    const id = String(item.id || "").trim();
    if (!id || byId.has(id)) return;
    byId.set(id, item);
  });
  return sortProfileEvents(Array.from(byId.values()));
}

export function albumMatchesProfileScope(
  album: AlbumPhotoWithMeta,
  ownerUsername?: string,
  ownerUserId?: string,
  ownedEventIds?: Set<string>,
) {
  const normalizedOwnerUsername = normalizeProfileValue(ownerUsername || "");
  const normalizedOwnerUserId = String(ownerUserId || "").trim();
  const uploaderUsername = normalizeProfileValue(album.username || "");
  const clubUsername = normalizeProfileValue(album.clubUsername || "");
  const uploaderId = String(album.userId || "").trim();
  const clubUserId = String(album.clubUserId || "").trim();
  const eventId = String(album.eventId || "").trim();

  if (
    normalizedOwnerUsername &&
    (uploaderUsername === normalizedOwnerUsername || clubUsername === normalizedOwnerUsername)
  ) {
    return true;
  }
  if (
    normalizedOwnerUserId &&
    (uploaderId === normalizedOwnerUserId || clubUserId === normalizedOwnerUserId)
  ) {
    return true;
  }
  if (eventId && ownedEventIds?.has(eventId)) return true;
  return false;
}

export function mergeScopedProfileAlbums(params: {
  sourceAlbums: AlbumPhotoWithMeta[];
  cachedHomeAlbums: AlbumPhotoWithMeta[];
  ownerUsername?: string;
  ownerUserId?: string;
  ownedEventIds?: Set<string>;
}) {
  const matchedHomeAlbums = params.cachedHomeAlbums.filter((item) =>
    albumMatchesProfileScope(item, params.ownerUsername, params.ownerUserId, params.ownedEventIds),
  );
  return sortProfileAlbums(mergeAlbumCollections(params.sourceAlbums, matchedHomeAlbums));
}

export function isClubOwnedAlbum(
  album: AlbumPhotoWithMeta,
  ownerUsername?: string,
  ownerUserId?: string,
) {
  const clubUsername = normalizeProfileValue(album.clubUsername || "");
  const uploaderUsername = normalizeProfileValue(album.username || "");
  const normalizedOwnerUsername = normalizeProfileValue(ownerUsername || "");
  const normalizedOwnerUserId = String(ownerUserId || "").trim();
  const uploaderId = String(album.userId || "").trim();
  const clubUserId = String(album.clubUserId || "").trim();
  if (normalizedOwnerUserId && uploaderId) return normalizedOwnerUserId === uploaderId;
  if (clubUserId && uploaderId) return clubUserId === uploaderId;
  if (normalizedOwnerUsername && uploaderUsername)
    return normalizedOwnerUsername === uploaderUsername;
  if (clubUsername && uploaderUsername) return clubUsername === uploaderUsername;
  return false;
}

export function filterClubAlbumsByOwner(
  albums: AlbumPhotoWithMeta[],
  ownerFilter: AlbumOwnerFilter,
  ownerUsername?: string,
  ownerUserId?: string,
) {
  if (ownerFilter === "all") return albums;
  return albums.filter((album) =>
    ownerFilter === "club"
      ? isClubOwnedAlbum(album, ownerUsername, ownerUserId)
      : !isClubOwnedAlbum(album, ownerUsername, ownerUserId),
  );
}

export function getProfileContentEntity(tab: ProfileContentTab) {
  if (tab === "album") return "profile-albums";
  return "profile-events";
}

export function getProfileProjectionPrefetchTabs(params: {
  activeTab: ProfileContentTab;
  albumsCount?: number;
  eventsCount?: number;
}) {
  const tabs: ProfileContentTab[] = [];
  if (params.activeTab !== "album" && Number(params.albumsCount || 0) > 0) {
    tabs.push("album");
  }
  if (params.activeTab !== "events" && Number(params.eventsCount || 0) > 0) {
    tabs.push("events");
  }
  return tabs;
}
