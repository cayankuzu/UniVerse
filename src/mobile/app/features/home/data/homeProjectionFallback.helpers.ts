import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { normalizeProjectionValue } from "../../../data/projections/projections.common";

export function filterFallbackHomeAlbums(
  albums: AlbumPhotoWithMeta[],
  events: EventWithMeta[],
  viewerUsername: string,
) {
  const normalizedViewer = normalizeProjectionValue(viewerUsername || "");
  const eventMap = new Map(events.map((item) => [String(item.id || "").trim(), item]));

  return albums.filter((album) => {
    const uploaderUsername = normalizeProjectionValue(album.username || "");
    const clubUsername = normalizeProjectionValue(album.clubUsername || "");
    const relatedEvent = eventMap.get(String(album.eventId || "").trim());
    const feedActorType = normalizeProjectionValue(relatedEvent?.feedActorType || "");
    const feedActorUsername = normalizeProjectionValue(relatedEvent?.feedActorUsername || "");
    const feedSource = normalizeProjectionValue(relatedEvent?.feedSource || "");
    const isClubOwnedAlbum = uploaderUsername !== "" && uploaderUsername === clubUsername;

    if (uploaderUsername !== "" && uploaderUsername === normalizedViewer) return true;
    if (feedActorType === "student") {
      return uploaderUsername !== "" && uploaderUsername === feedActorUsername;
    }
    if (isClubOwnedAlbum) return feedSource === "following_club" || feedSource === "own";
    return false;
  });
}
