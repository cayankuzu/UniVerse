import type { AlbumPhotoWithMeta } from "../contracts/content";
import { hydrateAlbumSurfaceFlags } from "../content/albums/albums.shared";
import { hasAlbumProjectionSurfaceFlags } from "../normalizers/albums";
import type { ProjectionEnvelope } from "../query/contracts";
import type { ProjectionHomeFeedItem } from "./projections.types";

function isHomeAlbumItem(
  item: ProjectionHomeFeedItem,
): item is ProjectionHomeFeedItem & { kind: "album"; album: AlbumPhotoWithMeta } {
  return (
    item.kind === "album" &&
    Boolean((item as ProjectionHomeFeedItem & { album?: AlbumPhotoWithMeta }).album)
  );
}

function patchAlbum<T extends AlbumPhotoWithMeta>(item: T, hydrated: AlbumPhotoWithMeta): T {
  return {
    ...item,
    showOnClubProfile: hydrated.showOnClubProfile,
    showOnOwnProfile: hydrated.showOnOwnProfile,
    showOnProfile: hydrated.showOnProfile,
    surfaceVisibility: hydrated.surfaceVisibility,
  };
}

function createHydratedAlbumMap(items: AlbumPhotoWithMeta[]) {
  return new Map(items.map((item) => [String(item.id || "").trim(), item]));
}

function normalizeHydrationIds(ids: Iterable<string>) {
  return Array.from(
    new Set(
      Array.from(ids)
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

export function getAlbumProjectionHydrationId(
  row: unknown,
  album: Pick<AlbumPhotoWithMeta, "id"> | null | undefined,
) {
  const albumId = String(album?.id || "").trim();
  if (!albumId || hasAlbumProjectionSurfaceFlags(row)) {
    return "";
  }
  return albumId;
}

export async function hydrateAlbumProjectionEnvelope<T extends AlbumPhotoWithMeta>(
  envelope: ProjectionEnvelope<T>,
  idsNeedingHydration: Iterable<string>,
): Promise<ProjectionEnvelope<T>> {
  const targetIds = normalizeHydrationIds(idsNeedingHydration);
  if (!targetIds.length) return envelope;

  const hydratedAlbums = await hydrateAlbumSurfaceFlags(
    [...(envelope.items || []), ...(envelope.updatedItems || [])],
    { ids: targetIds },
  );
  const hydratedMap = createHydratedAlbumMap(hydratedAlbums);

  return {
    ...envelope,
    items: (envelope.items || []).map((item) => {
      const hydrated = hydratedMap.get(String(item.id || "").trim());
      return hydrated ? patchAlbum(item, hydrated) : item;
    }),
    updatedItems: (envelope.updatedItems || []).map((item) => {
      const hydrated = hydratedMap.get(String(item.id || "").trim());
      return hydrated ? patchAlbum(item, hydrated) : item;
    }),
  };
}

export async function hydrateHomeProjectionEnvelopeAlbums(
  envelope: ProjectionEnvelope<ProjectionHomeFeedItem>,
  idsNeedingHydration: Iterable<string>,
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  const targetIds = normalizeHydrationIds(idsNeedingHydration);
  if (!targetIds.length) return envelope;

  const albums = [...(envelope.items || []), ...(envelope.updatedItems || [])]
    .filter(isHomeAlbumItem)
    .map((item) => item.album);
  const hydratedAlbums = await hydrateAlbumSurfaceFlags(albums, { ids: targetIds });
  const hydratedMap = createHydratedAlbumMap(hydratedAlbums);

  const patchItem = (item: ProjectionHomeFeedItem) => {
    if (item.kind !== "album" || !item.album) return item;
    const hydrated = hydratedMap.get(String(item.album.id || "").trim());
    if (!hydrated) return item;
    return {
      ...item,
      album: patchAlbum(item.album, hydrated),
    };
  };

  return {
    ...envelope,
    items: (envelope.items || []).map(patchItem),
    updatedItems: (envelope.updatedItems || []).map(patchItem),
  };
}
