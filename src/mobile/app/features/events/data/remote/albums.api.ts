import { AlbumAPI as CanonicalAlbumAPI } from "../../../../data/content/albums.api";
import { persistAlbumUpload } from "./albums.upload";

export const AlbumAPI = {
  ...CanonicalAlbumAPI,
  uploadPhoto: persistAlbumUpload,
};
