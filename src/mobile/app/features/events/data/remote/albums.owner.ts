// Owner-profile hydration queries events/profiles, so it belongs to the data layer. This module
// stays as the feature-local import surface (matching ./albums.shared) instead of a second copy.
export { hydrateAlbumOwnerProfiles } from "../../../../data/content/albums/albums.owner";
