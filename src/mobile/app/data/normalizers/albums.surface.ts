import type { AlbumPhotoWithMeta } from "../contracts/content";
import type { AlbumSurfaceVisibilitySnapshot, AlbumVisibilityLabel } from "../contracts/entities";
import { normalizeExplicitAlbumSurfaceVisibility } from "../policies/visibility.shared";

export type AlbumSurfaceContext = "event_album" | "feed" | "profile" | "search";

type AlbumViewerIdentity = {
  viewerId?: string | null;
  viewerUsername?: string | null;
};

type AlbumSurfaceLabelInput = {
  clubUsername?: string | null;
  eventId?: string | null;
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnProfile?: boolean;
  surfaceVisibility?: AlbumSurfaceVisibilitySnapshot | null;
  username?: string | null;
};

type AlbumSurfaceVisibilityInput = {
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnProfile?: boolean;
  surfaceVisibility?: AlbumSurfaceVisibilitySnapshot | null;
};

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hasExplicitSurfaceFlag(value: unknown) {
  return typeof value === "boolean";
}

export function isAlbumOnOwnProfileSurface(
  item: Pick<AlbumPhotoWithMeta, "showOnOwnProfile" | "showOnProfile" | "surfaceVisibility">,
) {
  return resolveAlbumSurfaceVisibility(item).showOnOwnProfile;
}

export function isAlbumOnClubSurface(
  item: Pick<AlbumPhotoWithMeta, "showOnClubProfile" | "showOnProfile" | "surfaceVisibility">,
) {
  return resolveAlbumSurfaceVisibility(item).showOnClubProfile;
}

export function isViewerOwnedAlbum(
  item: Pick<AlbumPhotoWithMeta, "clubUserId" | "clubUsername" | "userId" | "username">,
  viewer: AlbumViewerIdentity = {},
) {
  const viewerId = normalizeId(viewer.viewerId);
  const viewerUsername = normalizeUsername(viewer.viewerUsername);

  return Boolean(
    (viewerId &&
      (viewerId === normalizeId(item.userId) || viewerId === normalizeId(item.clubUserId))) ||
    (viewerUsername &&
      (viewerUsername === normalizeUsername(item.username) ||
        viewerUsername === normalizeUsername(item.clubUsername))),
  );
}

function resolveEventAlbumSurfaceVisibility(
  item: Pick<
    AlbumPhotoWithMeta,
    "eventId" | "showOnClubProfile" | "showOnOwnProfile" | "showOnProfile" | "surfaceVisibility"
  >,
) {
  const explicitClubFlag =
    hasExplicitSurfaceFlag(item.showOnClubProfile) ||
    hasExplicitSurfaceFlag(item.surfaceVisibility?.showOnClubProfile);
  const explicitOwnFlag =
    hasExplicitSurfaceFlag(item.showOnOwnProfile) ||
    hasExplicitSurfaceFlag(item.surfaceVisibility?.showOnOwnProfile);
  if (explicitClubFlag || explicitOwnFlag) {
    return resolveAlbumSurfaceVisibility(item);
  }

  const showOnProfile =
    typeof item.showOnProfile === "boolean"
      ? item.showOnProfile
      : typeof item.surfaceVisibility?.showOnProfile === "boolean"
        ? item.surfaceVisibility.showOnProfile
        : false;
  const hasEventId = Boolean(normalizeId(item.eventId));
  if (!showOnProfile || !hasEventId) {
    return resolveAlbumSurfaceVisibility(item);
  }

  return {
    label: buildAlbumSurfaceLabel({
      showOnClubProfile: true,
      showOnOwnProfile: true,
    }),
    showOnClubProfile: true,
    showOnOwnProfile: true,
    showOnProfile: true,
  };
}

export function filterEventAlbumSurfaceForViewer(
  items: AlbumPhotoWithMeta[],
  _viewer: AlbumViewerIdentity = {},
) {
  return items.filter((item) => {
    const visibility = resolveEventAlbumSurfaceVisibility(item);
    return visibility.showOnClubProfile && visibility.showOnOwnProfile;
  });
}

export function buildEventAlbumCardCountMap(
  items: Array<
    Pick<
      AlbumPhotoWithMeta,
      "eventId" | "showOnClubProfile" | "showOnProfile" | "surfaceVisibility"
    >
  >,
) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const eventId = String(item.eventId || "").trim();
    const visibility = resolveEventAlbumSurfaceVisibility(item);
    if (!eventId || !visibility.showOnClubProfile || !visibility.showOnOwnProfile) return;
    counts.set(eventId, (counts.get(eventId) || 0) + 1);
  });

  return counts;
}

function buildAlbumSurfaceLabel(
  visibility: Pick<AlbumSurfaceVisibilitySnapshot, "showOnClubProfile" | "showOnOwnProfile">,
): AlbumVisibilityLabel {
  if (visibility.showOnClubProfile && visibility.showOnOwnProfile) {
    return { text: "Kendim ve Kulüp", type: "club" };
  }
  if (visibility.showOnClubProfile) {
    return { text: "Kulüp", type: "club" };
  }
  if (visibility.showOnOwnProfile) {
    return { text: "Kendim", type: "own" };
  }
  return { text: "Kendim", type: "own" };
}

export function resolveAlbumSurfaceVisibility(
  item: AlbumSurfaceVisibilityInput,
): AlbumSurfaceVisibilitySnapshot {
  const visibility = normalizeExplicitAlbumSurfaceVisibility(item);
  return {
    ...visibility,
    label: buildAlbumSurfaceLabel(visibility),
  };
}

export function getAlbumSurfaceLabel(
  item: AlbumSurfaceLabelInput,
  context: AlbumSurfaceContext,
): { text: string; type: "club" | "own" } {
  if (context === "event_album") {
    return resolveEventAlbumSurfaceVisibility(item as AlbumPhotoWithMeta).label;
  }
  return resolveAlbumSurfaceVisibility(item).label;
}

export function filterAlbumsBySurfaceContext(
  items: AlbumPhotoWithMeta[],
  context: AlbumSurfaceContext,
) {
  if (context === "profile") return items;
  if (context === "search") {
    return items.filter((item) => !item.uploaderIsPrivate);
  }
  if (context === "event_album") {
    return items.filter((item) => {
      const visibility = resolveEventAlbumSurfaceVisibility(item);
      return visibility.showOnClubProfile && visibility.showOnOwnProfile;
    });
  }
  return items.filter((item) => resolveAlbumSurfaceVisibility(item).showOnProfile);
}
