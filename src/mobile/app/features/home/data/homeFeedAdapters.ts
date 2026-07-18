import {
  buildPreparedAlbumVisibility,
  buildPreparedEventAccessChip,
  buildPreparedEventInfoSlides,
  buildPreparedEventMetaChips,
  formatAlbumCreatedAtLabel,
  formatEventHeaderDate,
  formatEventHeaderTime,
  resolveAlbumUniversityLabel,
  resolveAvatarInitials,
  type PreparedAlbumVisibility,
  type PreparedEventAccessChip,
  type PreparedEventInfoSlide,
  type PreparedEventMetaChip,
} from "../../../features/content-cards/public/presentation";
import { buildEventAlbumCardCountMap } from "../../../data/normalizers/albums";
import type { ProjectionHomeFeedItem } from "../../../data/projections/projections.types";

export type HomeEventPresentation = {
  accessChip: PreparedEventAccessChip;
  albumCount: number;
  avatarInitials: string;
  clubSubtitle: string;
  createdAtDateLabel: string;
  createdAtTimeLabel: string;
  infoSlides: PreparedEventInfoSlide[];
  metaChips: PreparedEventMetaChip[];
};

export type HomeAlbumPresentation = {
  avatarInitials: string;
  createdAtLabel: string;
  photoCount: number;
  universityLabel: string;
  visibility: PreparedAlbumVisibility;
};

export type HomeFeedItem = ProjectionHomeFeedItem & {
  firstFoldVariant?: "thumbnail";
  homePresentation?: HomeAlbumPresentation | HomeEventPresentation;
  primaryClubUsername?: string;
  rowSignature?: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeSortDate(value: string) {
  const timestamp = new Date(String(value || "")).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildAlbumCountByEventId(items: ProjectionHomeFeedItem[]) {
  return buildEventAlbumCardCountMap(
    items
      .filter((item): item is ProjectionHomeFeedItem & { kind: "album" } => item.kind === "album")
      .map((item) => item.album),
  );
}

function buildEventRowSignature(item: ProjectionHomeFeedItem & { kind: "event" }) {
  return [
    "event",
    item.id,
    item.sortDate,
    item.source,
    item.actor,
    item.event.title,
    item.event.image,
    item.event.clubImage,
    item.event.comments,
    item.event.likes,
    item.event.liked ? "liked" : "unliked",
    item.event.joined ? "joined" : "not-joined",
    item.event.attendees,
    item.event.albumCount,
  ].join("|");
}

function buildAlbumRowSignature(item: ProjectionHomeFeedItem & { kind: "album" }) {
  const visibility = buildPreparedAlbumVisibility(item.album, "feed");
  return [
    "album",
    item.id,
    item.sortDate,
    item.source,
    item.actor,
    item.album.title,
    item.album.image,
    item.album.userImage,
    item.album.comments,
    item.album.likes,
    item.album.liked ? "liked" : "unliked",
    item.album.photoCount,
    item.album.createdAt,
    item.album.showOnOwnProfile ? "own-surface" : "no-own-surface",
    item.album.showOnClubProfile ? "club-surface" : "no-club-surface",
    `${visibility.type}:${visibility.text}`,
  ].join("|");
}

function prepareEventItem(item: ProjectionHomeFeedItem & { kind: "event" }): HomeFeedItem {
  const createdAtDateLabel = formatEventHeaderDate(item.event.createdAt);
  const createdAtTimeLabel = formatEventHeaderTime(item.event.createdAt);
  const albumCount = Math.max(Number(item.event.albumCount || 0), 0);
  return {
    ...item,
    firstFoldVariant: "thumbnail",
    homePresentation: {
      accessChip: buildPreparedEventAccessChip(item.event),
      albumCount,
      avatarInitials: resolveAvatarInitials(item.event.club),
      clubSubtitle: normalizeText(item.event.university),
      createdAtDateLabel,
      createdAtTimeLabel,
      infoSlides: buildPreparedEventInfoSlides(item.event, {
        dateLabel: normalizeText(item.event.startDate || item.event.date) || "-",
        timeLabel:
          item.event.startTime && item.event.endTime
            ? `${item.event.startTime} - ${item.event.endTime}`
            : "-",
      }),
      metaChips: buildPreparedEventMetaChips(item.event),
    },
    primaryClubUsername: normalizeText(item.event.clubUsername).toLowerCase(),
    rowSignature: buildEventRowSignature(item),
  };
}

function prepareAlbumItem(item: ProjectionHomeFeedItem & { kind: "album" }): HomeFeedItem {
  return {
    ...item,
    firstFoldVariant: "thumbnail",
    homePresentation: {
      avatarInitials: resolveAvatarInitials(item.album.name),
      createdAtLabel: formatAlbumCreatedAtLabel(item.album.createdAt),
      photoCount: Math.max(Number(item.album.photoCount || item.album.images?.length || 1), 1),
      universityLabel: resolveAlbumUniversityLabel(item.album),
      visibility: buildPreparedAlbumVisibility(item.album, "feed"),
    },
    primaryClubUsername: normalizeText(item.album.clubUsername).toLowerCase(),
    rowSignature: buildAlbumRowSignature(item),
  };
}

export function hydrateHomeEventAlbumCounts(items: ProjectionHomeFeedItem[]) {
  const albumCountByEventId = buildAlbumCountByEventId(items);

  return items.map((item) => {
    if (item.kind !== "event") return item;
    const eventId = normalizeText(item.event.id);
    const derivedAlbumCount = albumCountByEventId.get(eventId);
    if (typeof derivedAlbumCount !== "number") return item;
    return {
      ...item,
      event: {
        ...item.event,
        albumCount: Math.max(Number(item.event.albumCount || 0), derivedAlbumCount),
      },
    };
  });
}

export function sortHomeFeedItems(
  items: ProjectionHomeFeedItem[],
  sortOption: "newest" | "oldest" = "newest",
) {
  const direction = sortOption === "oldest" ? 1 : -1;
  return [...items].sort((left, right) => {
    const dateDelta = normalizeSortDate(left.sortDate) - normalizeSortDate(right.sortDate);
    if (dateDelta !== 0) {
      return dateDelta * direction;
    }
    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

export function prepareHomeFeedItems(
  items: ProjectionHomeFeedItem[],
  sortOption: "newest" | "oldest" = "newest",
): HomeFeedItem[] {
  return hydrateHomeEventAlbumCounts(sortHomeFeedItems(items, sortOption)).map((item) =>
    item.kind === "event" ? prepareEventItem(item) : prepareAlbumItem(item),
  );
}
