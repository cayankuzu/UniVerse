import { useMemo, useRef } from "react";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import type { HomeFeedItem } from "../data";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildItemSignature(items: HomeFeedItem[]) {
  return items
    .map((item) => item.rowSignature || `${item.kind}:${item.id}:${item.sortDate}`)
    .join("|");
}

const EMPTY_HOME_ITEMS: HomeFeedItem[] = [];
const EMPTY_STABLE_HOME_ITEMS = {
  items: EMPTY_HOME_ITEMS,
  signature: "",
};

type UseHomeFeedCollectionsParams = {
  blockedUsers?: string[];
  buildRelationByClub: (clubs: string[]) => Record<string, RelationSnapshot>;
  enforceFollowVisibility?: boolean;
  followingClubUsernames?: Set<string>;
  followingUsernames?: Set<string>;
  homeProjectionIdsLength?: number;
  homeProjectionItems: HomeFeedItem[];
  isFetching: boolean;
  startupPreviewItems?: HomeFeedItem[];
  useStartupPreview?: boolean;
  refreshing: boolean;
  viewerUsername?: string;
};

function isBlockedHomeItem(item: HomeFeedItem, blockedSet: Set<string>, viewerUsername: string) {
  if (item.kind === "event") {
    return (
      blockedSet.has(normalize(item.event.clubUsername || "")) ||
      blockedSet.has(normalize(item.event.feedActorUsername || ""))
    );
  }

  if (normalize(item.album.username || "") === viewerUsername) {
    return false;
  }

  return (
    blockedSet.has(normalize(item.album.username || "")) ||
    blockedSet.has(normalize(item.album.clubUsername || ""))
  );
}

function resolveViewerUsername(items: HomeFeedItem[], explicitViewerUsername?: string) {
  const normalizedExplicit = normalize(explicitViewerUsername || "");
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  for (const item of items) {
    if (item.source !== "own") {
      continue;
    }
    if (item.kind === "album") {
      const albumViewerUsername = normalize(item.album.username || item.album.clubUsername || "");
      if (albumViewerUsername) {
        return albumViewerUsername;
      }
      continue;
    }
    const eventViewerUsername = normalize(
      item.event.feedActorUsername || item.event.clubUsername || "",
    );
    if (eventViewerUsername) {
      return eventViewerUsername;
    }
  }

  return "";
}

function isVisibleForCurrentFollowState(
  item: HomeFeedItem,
  viewerUsername: string,
  followingClubUsernames: Set<string>,
  followingUsernames: Set<string>,
) {
  if (item.source === "own") {
    return true;
  }

  if (item.kind === "event") {
    return followingClubUsernames.has(normalize(item.event.clubUsername || ""));
  }

  const uploaderUsername = normalize(item.album.username || "");
  if (uploaderUsername && uploaderUsername === viewerUsername) {
    return true;
  }
  if (uploaderUsername) {
    return followingUsernames.has(uploaderUsername);
  }

  return followingClubUsernames.has(normalize(item.album.clubUsername || ""));
}

export function useHomeFeedCollections(params: UseHomeFeedCollectionsParams) {
  const { buildRelationByClub } = params;
  const stableItemsRef = useRef(EMPTY_STABLE_HOME_ITEMS);
  const blockedSet = useMemo(
    () => new Set((params.blockedUsers || []).map((item) => normalize(item)).filter(Boolean)),
    [params.blockedUsers],
  );
  const followingClubUsernames = useMemo(
    () => params.followingClubUsernames || new Set<string>(),
    [params.followingClubUsernames],
  );
  const followingUsernames = useMemo(
    () => params.followingUsernames || new Set<string>(),
    [params.followingUsernames],
  );
  const resolvedStartupPreviewItems = useMemo(
    () =>
      params.useStartupPreview ? params.startupPreviewItems || EMPTY_HOME_ITEMS : EMPTY_HOME_ITEMS,
    [params.startupPreviewItems, params.useStartupPreview],
  );
  const projectionItems = params.homeProjectionItems;
  const projectionSignature = useMemo(() => buildItemSignature(projectionItems), [projectionItems]);
  const startupPreviewSignature = useMemo(
    () => buildItemSignature(resolvedStartupPreviewItems),
    [resolvedStartupPreviewItems],
  );
  const effectiveItems = useMemo<HomeFeedItem[]>(() => {
    if (projectionItems.length > 0) {
      if (stableItemsRef.current.signature !== projectionSignature) {
        stableItemsRef.current = {
          items: projectionItems,
          signature: projectionSignature,
        };
      }
      return projectionItems;
    }

    if (resolvedStartupPreviewItems.length > 0) {
      if (stableItemsRef.current.signature !== startupPreviewSignature) {
        stableItemsRef.current = {
          items: resolvedStartupPreviewItems,
          signature: startupPreviewSignature,
        };
      }
      return resolvedStartupPreviewItems;
    }

    if (params.isFetching || params.refreshing) {
      return stableItemsRef.current.items;
    }

    if ((params.homeProjectionIdsLength || 0) === 0 && stableItemsRef.current.items.length > 0) {
      stableItemsRef.current = EMPTY_STABLE_HOME_ITEMS;
    }

    return EMPTY_HOME_ITEMS;
  }, [
    params.homeProjectionIdsLength,
    params.isFetching,
    params.refreshing,
    projectionItems,
    projectionSignature,
    resolvedStartupPreviewItems,
    startupPreviewSignature,
  ]);
  const resolvedViewerUsername = useMemo(
    () => resolveViewerUsername(effectiveItems, params.viewerUsername),
    [effectiveItems, params.viewerUsername],
  );
  const scannedCollections = useMemo(() => {
    const visibleItems: HomeFeedItem[] = [];
    const visibleEvents: EventWithMeta[] = [];
    const visibleAlbums: AlbumPhotoWithMeta[] = [];
    const nextPageImageItems: Array<EventWithMeta | AlbumPhotoWithMeta> = [];
    const eventClubSet = new Set<string>();
    const albumClubSet = new Set<string>();
    let tourAlbumIndex = -1;
    let tourEventIndex = -1;

    for (const item of effectiveItems) {
      if (isBlockedHomeItem(item, blockedSet, resolvedViewerUsername)) {
        continue;
      }
      if (
        params.enforceFollowVisibility &&
        !isVisibleForCurrentFollowState(
          item,
          resolvedViewerUsername,
          followingClubUsernames,
          followingUsernames,
        )
      ) {
        continue;
      }

      visibleItems.push(item);
      const visibleIndex = visibleItems.length - 1;

      if (item.kind === "event") {
        visibleEvents.push(item.event);
        nextPageImageItems.push(item.event);
        const club = normalize(item.primaryClubUsername || item.event.clubUsername || "");
        if (club) eventClubSet.add(club);
        if (tourEventIndex < 0) tourEventIndex = visibleIndex;
        continue;
      }

      visibleAlbums.push(item.album);
      nextPageImageItems.push(item.album);
      const club = normalize(item.primaryClubUsername || item.album.clubUsername || "");
      if (club) albumClubSet.add(club);
      if (tourAlbumIndex < 0) tourAlbumIndex = visibleIndex;
    }

    return {
      albumClubSignature: Array.from(albumClubSet).join("|"),
      albumClubs: Array.from(albumClubSet),
      eventClubSignature: Array.from(eventClubSet).join("|"),
      eventClubs: Array.from(eventClubSet),
      visibleItems,
      nextPageImageItems,
      tourAlbumIndex: Math.max(0, tourAlbumIndex),
      tourEventIndex: Math.max(0, tourEventIndex),
      visibleAlbums,
      visibleEvents,
    };
  }, [
    blockedSet,
    effectiveItems,
    followingClubUsernames,
    followingUsernames,
    params.enforceFollowVisibility,
    resolvedViewerUsername,
  ]);

  const eventRelationByClub = useMemo(
    () => buildRelationByClub(scannedCollections.eventClubs),
    [buildRelationByClub, scannedCollections.eventClubs],
  );

  const albumRelationByClub = useMemo(
    () => buildRelationByClub(scannedCollections.albumClubs),
    [buildRelationByClub, scannedCollections.albumClubs],
  );

  return {
    albumRelationByClub,
    effectiveItems: scannedCollections.visibleItems,
    eventRelationByClub,
    nextPageImageItems: scannedCollections.nextPageImageItems,
    tourAlbumIndex: scannedCollections.tourAlbumIndex,
    tourEventIndex: scannedCollections.tourEventIndex,
    visibleAlbums: scannedCollections.visibleAlbums,
    visibleEvents: scannedCollections.visibleEvents,
  };
}
