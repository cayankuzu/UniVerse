import type { AlbumPhotoWithMeta } from "../contracts/content";
import { normalizeAlbumVisibility } from "../policies/visibility.shared";
import { resolveAlbumSurfaceVisibility } from "./albums.surface";

function firstNonEmptyText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function resolveBestImages(primaryImages?: string[] | null, fallbackImages?: string[] | null) {
  const normalizedPrimary = Array.isArray(primaryImages) ? primaryImages.filter(Boolean) : [];
  const normalizedFallback = Array.isArray(fallbackImages) ? fallbackImages.filter(Boolean) : [];
  if (normalizedPrimary.length >= normalizedFallback.length) {
    return normalizedPrimary.length ? normalizedPrimary : normalizedFallback;
  }
  return normalizedFallback;
}

function resolveAlbumVisibility(
  item: Pick<
    AlbumPhotoWithMeta,
    "showOnClubProfile" | "showOnOwnProfile" | "showOnProfile" | "surfaceVisibility"
  >,
) {
  return normalizeAlbumVisibility(item, { ownFallbackToProfile: true });
}

export function mergeAlbumItem(
  primary: AlbumPhotoWithMeta,
  fallback: AlbumPhotoWithMeta,
): AlbumPhotoWithMeta {
  const resolvedUniversity = firstNonEmptyText(
    primary.userUniversity,
    fallback.userUniversity,
    (primary as AlbumPhotoWithMeta & { university?: string }).university,
    (fallback as AlbumPhotoWithMeta & { university?: string }).university,
  );
  const resolvedImages = resolveBestImages(primary.images, fallback.images);
  const resolvedImage = firstNonEmptyText(primary.image, fallback.image, resolvedImages[0]);
  const visibility = resolveAlbumSurfaceVisibility(
    resolveAlbumVisibility({
      showOnClubProfile: primary.showOnClubProfile ?? fallback.showOnClubProfile,
      showOnOwnProfile: primary.showOnOwnProfile ?? fallback.showOnOwnProfile,
      showOnProfile: primary.showOnProfile ?? fallback.showOnProfile,
      surfaceVisibility: primary.surfaceVisibility ?? fallback.surfaceVisibility,
    }),
  );

  return {
    ...fallback,
    ...primary,
    userId: firstNonEmptyText(primary.userId, fallback.userId),
    username: firstNonEmptyText(primary.username, fallback.username),
    name: firstNonEmptyText(primary.name, fallback.name),
    userImage: firstNonEmptyText(primary.userImage, fallback.userImage),
    userUniversity: resolvedUniversity,
    eventId: firstNonEmptyText(primary.eventId, fallback.eventId),
    eventTitle: firstNonEmptyText(primary.eventTitle, fallback.eventTitle),
    image: resolvedImage,
    images: resolvedImages.length ? resolvedImages : undefined,
    photoCount: Math.max(Number(primary.photoCount || 0), Number(fallback.photoCount || 0)) || 1,
    caption: firstNonEmptyText(primary.caption, fallback.caption) || undefined,
    createdAt: firstNonEmptyText(primary.createdAt, fallback.createdAt),
    likes: Math.max(Number(primary.likes || 0), Number(fallback.likes || 0)),
    liked: Boolean(primary.liked || fallback.liked),
    comments: Math.max(Number(primary.comments || 0), Number(fallback.comments || 0)),
    title: firstNonEmptyText(primary.title, fallback.title) || undefined,
    clubUserId: firstNonEmptyText(primary.clubUserId, fallback.clubUserId) || undefined,
    clubUsername: firstNonEmptyText(primary.clubUsername, fallback.clubUsername) || undefined,
    clubName: firstNonEmptyText(primary.clubName, fallback.clubName) || undefined,
    lockedReasonCode:
      firstNonEmptyText(primary.lockedReasonCode, fallback.lockedReasonCode) || undefined,
    lockedReasonText:
      firstNonEmptyText(primary.lockedReasonText, fallback.lockedReasonText) || undefined,
    canDiscoverAlbum: primary.canDiscoverAlbum ?? fallback.canDiscoverAlbum,
    canOpenAlbum: primary.canOpenAlbum ?? fallback.canOpenAlbum,
    canOpenAlbumEventDetail: primary.canOpenAlbumEventDetail ?? fallback.canOpenAlbumEventDetail,
    canInteractAlbum: primary.canInteractAlbum ?? fallback.canInteractAlbum,
    eventVisibility: primary.eventVisibility || fallback.eventVisibility,
    effectiveVisibility: primary.effectiveVisibility || fallback.effectiveVisibility,
    clubIsPrivate: primary.clubIsPrivate ?? fallback.clubIsPrivate,
    uploaderIsPrivate: primary.uploaderIsPrivate ?? fallback.uploaderIsPrivate,
    viewerJoinedEvent: primary.viewerJoinedEvent ?? fallback.viewerJoinedEvent,
    showOnOwnProfile: visibility.showOnOwnProfile,
    showOnClubProfile: visibility.showOnClubProfile,
    showOnProfile: visibility.showOnProfile,
    surfaceVisibility: visibility,
    ...(resolvedUniversity ? { university: resolvedUniversity } : {}),
  } as AlbumPhotoWithMeta;
}

export function mergeAlbumCollections(
  ...collections: AlbumPhotoWithMeta[][]
): AlbumPhotoWithMeta[] {
  const merged = new Map<string, AlbumPhotoWithMeta>();

  collections.forEach((items) => {
    items.forEach((item) => {
      if (!item?.id) return;
      const existing = merged.get(item.id);
      merged.set(item.id, existing ? mergeAlbumItem(existing, item) : item);
    });
  });

  return Array.from(merged.values());
}
