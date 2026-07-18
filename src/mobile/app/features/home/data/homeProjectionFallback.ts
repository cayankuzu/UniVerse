import { AlbumAPI, EventAPI } from "../../../data/content";
import { mergeAlbumItem } from "../../../data/normalizers/albums";
import {
  buildHomeProjectionItems,
  filterLegacyHomeItems,
} from "../../../data/projections/projections.api.helpers";
import type {
  HomeProjectionParams,
  ProjectionHomeFeedItem,
} from "../../../data/projections/projections.types";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function mergeProjectionItemsById<T extends { id: string }>(...collections: T[][]): T[] {
  const merged = new Map<string, T>();
  collections.forEach((items) => {
    items.forEach((item) => {
      if (!item?.id) return;
      merged.set(item.id, item);
    });
  });
  return Array.from(merged.values());
}

function isAlbumHomeItem(
  item: ProjectionHomeFeedItem | null | undefined,
): item is ProjectionHomeFeedItem & { kind: "album" } {
  return Boolean(item && item.kind === "album" && item.album);
}

function isEventHomeItem(
  item: ProjectionHomeFeedItem | null | undefined,
): item is ProjectionHomeFeedItem & { kind: "event" } {
  return Boolean(item && item.kind === "event" && item.event);
}

function mergeHomeProjectionItem<T extends ProjectionHomeFeedItem>(primary: T, fallback: T) {
  if (isAlbumHomeItem(primary) && isAlbumHomeItem(fallback)) {
    return {
      ...fallback,
      ...primary,
      album: mergeAlbumItem(primary.album, fallback.album),
    } satisfies T;
  }

  if (isEventHomeItem(primary) && isEventHomeItem(fallback)) {
    return {
      ...fallback,
      ...primary,
      event: {
        ...fallback.event,
        ...primary.event,
      },
    } satisfies T;
  }

  return primary;
}

export function mergeHomeFeedItemsById<T extends ProjectionHomeFeedItem>(
  ...collections: T[][]
): T[] {
  const merged = new Map<string, T>();
  collections.forEach((items) => {
    items.forEach((item) => {
      if (!item?.id) return;
      const existing = merged.get(item.id);
      merged.set(item.id, existing ? mergeHomeProjectionItem(existing, item) : item);
    });
  });
  return Array.from(merged.values());
}

export async function buildOwnClubHomeItems(
  params: HomeProjectionParams,
): Promise<ProjectionHomeFeedItem[]> {
  if (params.viewerAccountType !== "club") return [];
  const normalizedViewer = normalize(params.viewerUsername || "");
  if (!normalizedViewer) return [];

  const ownEvents = await EventAPI.getByClub(normalizedViewer);
  if (ownEvents.length === 0) return [];

  const ownAlbums = await AlbumAPI.getHomeFeed(ownEvents.map((item) => item.id));
  return filterLegacyHomeItems(
    buildHomeProjectionItems({
      albums: ownAlbums,
      events: ownEvents,
      viewerUsername: normalizedViewer,
    }),
    params,
  );
}
