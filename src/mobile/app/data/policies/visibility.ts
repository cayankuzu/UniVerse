import {
  canViewAlbum,
  canViewEvent,
  getAlbumButtonAction,
  getEventActionAccess,
} from "./visibility.access";
import { getAlbumSurfaceLabel, type AlbumSurfaceContext } from "../normalizers/albums";
import type { BaseEntity, RelationSnapshot } from "./visibility.shared";

export type {
  AlbumAccessResult,
  AlbumButtonAction,
  AlbumVisibilityInput,
  BaseEntity,
  EventAccessResult,
  EventActionAccess,
  RelationSnapshot,
} from "./visibility.shared";
export { canViewAlbum, canViewEvent, getAlbumButtonAction, getEventActionAccess };
export {
  isFollowerOf,
  isFollowing,
  normalizeExplicitAlbumSurfaceVisibility,
  normalizeAlbumVisibility,
  normalizeSharedEventAlbumVisibility,
} from "./visibility.shared";

export function getAlbumVisibilityLabel(
  album: BaseEntity & {
    showOnClubProfile?: boolean;
    showOnOwnProfile?: boolean;
  },
  context: AlbumSurfaceContext = "feed",
) {
  return getAlbumSurfaceLabel(
    {
      clubUsername: album.clubUsername,
      eventId: album.eventId,
      showOnClubProfile: album.showOnClubProfile,
      showOnOwnProfile: album.showOnOwnProfile,
      showOnProfile: album.showOnProfile,
      surfaceVisibility: album.surfaceVisibility,
      username: album.username,
    },
    context,
  );
}

export function getEventVisibilityLabel(
  _event: BaseEntity,
  _clubIsPrivate = false,
): { text: string; type: "public" | "members_only" | "followers_only" } {
  return { text: "Herkese Açık", type: "public" };
}

export function filterVisibleEvents<T extends BaseEntity>(
  currentUsername: string,
  events: T[],
  relationByClub?: Record<string, RelationSnapshot>,
): T[] {
  return events.filter(
    (event) =>
      canViewEvent(
        currentUsername,
        event,
        relationByClub?.[
          String(event.clubUsername || "")
            .trim()
            .toLowerCase()
        ] || {},
      ).canView,
  );
}

export function filterVisibleAlbums<T extends BaseEntity & { username?: string }>(
  currentUsername: string,
  albums: T[],
  context: "feed" | "search" | "profile" | "event_album" = "feed",
  relationByClub?: Record<string, RelationSnapshot>,
): T[] {
  return albums.filter(
    (album) =>
      canViewAlbum(
        currentUsername,
        album,
        context,
        relationByClub?.[
          String(album.clubUsername || "")
            .trim()
            .toLowerCase()
        ] || {},
      ).canView,
  );
}
