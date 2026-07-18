export type { AlbumProjectionRpcRow } from "./albums.normalize";
export {
  hasAlbumProjectionSurfaceFlags,
  mapAlbumProjectionRow,
  mergeAlbumCollections,
  mergeAlbumItem,
  normalizeAlbumProjectionItem,
} from "./albums.normalize";
export type { AlbumSurfaceContext } from "./albums.surface";
export {
  buildEventAlbumCardCountMap,
  filterEventAlbumSurfaceForViewer,
  filterAlbumsBySurfaceContext,
  getAlbumSurfaceLabel,
  resolveAlbumSurfaceVisibility,
  isAlbumOnClubSurface,
  isAlbumOnOwnProfileSurface,
  isViewerOwnedAlbum,
} from "./albums.surface";
