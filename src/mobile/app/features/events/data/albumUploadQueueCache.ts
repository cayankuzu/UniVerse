import type { QueryClient } from "@tanstack/react-query";
import {
  isAlbumOnClubSurface,
  resolveAlbumSurfaceVisibility,
} from "../../../data/normalizers/albums";
import type {
  AlbumEventProjectionItem,
  EventDetailProjection,
} from "../../../data/projections/projections.types";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { prependProjectionItem } from "../../../data/projections/projections";
import { applyEntityPatches, markProjectionStale } from "../../../data/projections/patchEnvelope";
import { refreshViewerHomeAndSearch } from "../../../data/projections/projectionRefresh";
import type { AlbumUploadQueueUser } from "./albumUploadQueue.types";

function buildHomeAlbumItem(params: {
  accountType: "club" | "student";
  album: AlbumEventProjectionItem;
}) {
  return {
    actor: params.accountType === "club" ? "club" : "student",
    album: params.album,
    id: `album:${params.album.id}`,
    kind: "album" as const,
    sortDate: params.album.createdAt || new Date().toISOString(),
    source: "own" as const,
  };
}

const DEFAULT_ALBUM_SEARCH_SCOPE = JSON.stringify({
  category: "",
  fee: "",
  q: "",
  sort: "newest",
  university: "",
  visibility: "",
});

export function patchAlbumUploadCaches(params: {
  accountType: "club" | "student";
  album: AlbumEventProjectionItem;
  queryClient: QueryClient;
  userData: AlbumUploadQueueUser;
  viewerKey: string;
}) {
  const { accountType, album, queryClient, userData, viewerKey } = params;
  const visibility = resolveAlbumSurfaceVisibility(album);
  const showOnClubSurface = isAlbumOnClubSurface(album);

  if (showOnClubSurface) {
    prependProjectionItem({
      entity: "album-event",
      item: album,
      queryClient,
      screenKey: projectionKeys.albumEvent(album.eventId, viewerKey),
    });
  }
  if (visibility.showOnOwnProfile && userData.username) {
    prependProjectionItem({
      entity: "profile-albums",
      item: album,
      queryClient,
      screenKey: projectionKeys.profileContent(userData.username, "album", viewerKey),
    });
  }
  if (
    visibility.showOnClubProfile &&
    album.clubUsername &&
    album.clubUsername !== userData.username
  ) {
    prependProjectionItem({
      entity: "profile-albums",
      item: album,
      queryClient,
      screenKey: projectionKeys.profileContent(album.clubUsername, "album", viewerKey),
    });
  }
  if (showOnClubSurface) {
    prependProjectionItem({
      entity: "home-feed",
      item: buildHomeAlbumItem({ accountType, album }),
      queryClient,
      screenKey: projectionKeys.home(viewerKey, "all:all:all:newest"),
    });
    prependProjectionItem({
      entity: "search-albums",
      item: album,
      queryClient,
      screenKey: projectionKeys.search("albums", viewerKey, DEFAULT_ALBUM_SEARCH_SCOPE),
    });
  }
  if (visibility.showOnOwnProfile && userData.username) {
    markProjectionStale(
      queryClient,
      projectionKeys.profileContent(userData.username, "album", viewerKey),
    );
  }
  if (visibility.showOnClubProfile && album.clubUsername) {
    markProjectionStale(
      queryClient,
      projectionKeys.profileContent(album.clubUsername, "album", viewerKey),
    );
  }
  if (showOnClubSurface) {
    refreshViewerHomeAndSearch(queryClient, viewerKey);
  }

  const currentDetail = queryClient.getQueryData(
    projectionKeys.entity("event-detail", album.eventId),
  ) as EventDetailProjection | null;
  if (!showOnClubSurface) return;

  const nextAlbumCount = Math.max(0, Number(currentDetail?.albumCount || 0) + 1);
  applyEntityPatches(queryClient, [
    {
      changes: {
        albumCount: nextAlbumCount,
        event: currentDetail?.event
          ? { ...currentDetail.event, albumCount: nextAlbumCount }
          : currentDetail?.event,
      },
      entity: "event-detail",
      id: album.eventId,
    },
  ]);
}
