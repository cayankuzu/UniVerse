import { useMemo, useRef } from "react";
import type { AlbumPhotoWithMeta } from "../../../data/contracts/content";
import { mergeAlbumItem } from "../../../data/normalizers/albums";
import { sortProfileAlbums } from "./profileCollections";

function buildAlbumStabilityKey(items: AlbumPhotoWithMeta[]) {
  return items
    .map((item) => {
      const id = String(item.id || "").trim();
      const photoCount = Number(item.photoCount || 0);
      const imageCount = Array.isArray(item.images) ? item.images.length : 0;
      return [
        id,
        photoCount,
        imageCount,
        String(item.createdAt || ""),
        String(item.title || ""),
        String(item.caption || ""),
        String(item.image || ""),
        String(item.username || ""),
        String(item.name || ""),
        String(item.userImage || ""),
        String(item.userUniversity || ""),
        String(item.clubUsername || ""),
        String(item.clubName || ""),
      ].join(":");
    })
    .sort()
    .join("|");
}

function stabilizeAlbumCards(
  previous: AlbumPhotoWithMeta[],
  next: AlbumPhotoWithMeta[],
  preserveWhenEmpty: boolean,
) {
  if (!next.length) {
    return preserveWhenEmpty ? previous : next;
  }

  const previousById = new Map(
    previous
      .map((item) => [String(item.id || "").trim(), item] as const)
      .filter(([id]) => Boolean(id)),
  );

  return sortProfileAlbums(
    next.map((item) => {
      const id = String(item.id || "").trim();
      const previousItem = id ? previousById.get(id) : null;
      return previousItem ? mergeAlbumItem(item, previousItem) : item;
    }),
  );
}

export function useStableProfileAlbums(albums: AlbumPhotoWithMeta[], preserveWhenEmpty: boolean) {
  const incomingKey = useMemo(() => buildAlbumStabilityKey(albums), [albums]);
  const stableAlbumsRef = useRef<{
    albums: AlbumPhotoWithMeta[];
    key: string;
  }>({
    albums,
    key: incomingKey,
  });

  const nextAlbums = stabilizeAlbumCards(stableAlbumsRef.current.albums, albums, preserveWhenEmpty);
  const nextKey = buildAlbumStabilityKey(nextAlbums);

  if (stableAlbumsRef.current.key !== nextKey) {
    stableAlbumsRef.current = {
      albums: nextAlbums,
      key: nextKey,
    };
  }

  return stableAlbumsRef.current.albums;
}
