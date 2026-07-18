import { t } from "../../../shared/i18n";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { SearchUserResult } from "../../../data/contracts/api";
import type { SearchType } from "../domain/types";
import { normalize } from "../domain/searchHelpers";
import { isOwnSearchAlbum, isOwnSearchEvent, isOwnSearchUser } from "../domain/searchSelfExclusion";
import {
  isSearchAlbumVisible,
  isSearchEventVisible,
  isSearchUserVisible,
} from "../data/searchVisibility";

export interface ViewerIdentity {
  userId?: string | null;
  username?: string | null;
}

export function resolveSearchEmptyText(type: SearchType, hasSearchIntent: boolean) {
  if (!hasSearchIntent) {
    if (type === "albums") return t("search.empty.default.albums");
    if (type === "events") return t("search.empty.default.events");
    if (type === "clubs") return t("search.empty.default.clubs");
    return t("search.empty.default.students");
  }
  if (type === "albums") return t("search.empty.results.albums");
  if (type === "events") return t("search.empty.results.events");
  return t("search.empty.results.default");
}

export function filterSearchEvents(params: {
  blockedSet: Set<string>;
  excludeFollowedContent?: boolean;
  followingClubUsernames: Set<string>;
  followingUsernames: Set<string>;
  items: EventWithMeta[];
  viewerIdentity: ViewerIdentity;
}) {
  const {
    blockedSet,
    excludeFollowedContent,
    followingClubUsernames,
    followingUsernames,
    items,
    viewerIdentity,
  } = params;
  const blockedFilteredItems = items.filter((item) => {
    const clubUsername = normalize(item.clubUsername || "");
    const actorUsername = normalize(item.feedActorUsername || "");
    if (!clubUsername || blockedSet.has(clubUsername)) return false;
    if (actorUsername && blockedSet.has(actorUsername)) return false;
    return true;
  });

  const visibleItems = blockedFilteredItems.filter((item) => {
    if (isOwnSearchEvent(item, viewerIdentity)) return false;
    return isSearchEventVisible(item, {
      excludeFollowedContent,
      followingClubUsernames,
      followingUsernames,
      viewerUsername: viewerIdentity.username,
    });
  });
  return visibleItems;
}

export function filterSearchAlbums(params: {
  blockedSet: Set<string>;
  excludeFollowedContent?: boolean;
  followingClubUsernames: Set<string>;
  followingUsernames: Set<string>;
  items: AlbumPhotoWithMeta[];
  viewerIdentity: ViewerIdentity;
}) {
  const {
    blockedSet,
    excludeFollowedContent,
    followingClubUsernames,
    followingUsernames,
    items,
    viewerIdentity,
  } = params;
  const blockedFilteredItems = items.filter((item) => {
    const uploader = normalize(item.username);
    const clubUsername = normalize(item.clubUsername || "");
    if (!uploader || blockedSet.has(uploader)) return false;
    if (clubUsername && blockedSet.has(clubUsername)) return false;
    return true;
  });

  const visibleItems = blockedFilteredItems.filter((item) => {
    if (isOwnSearchAlbum(item, viewerIdentity)) return false;
    return isSearchAlbumVisible(item, {
      excludeFollowedContent,
      followingClubUsernames,
      followingUsernames,
      viewerUsername: viewerIdentity.username,
    });
  });
  return visibleItems;
}

export function filterSearchUsers(params: {
  blockedSet: Set<string>;
  excludeFollowedContent?: boolean;
  followingUsernames: Set<string>;
  items: SearchUserResult[];
  viewerIdentity: ViewerIdentity;
}) {
  const { blockedSet, excludeFollowedContent, followingUsernames, items, viewerIdentity } = params;
  const blockedFilteredItems = items.filter((item) => {
    const username = normalize(item.username);
    return Boolean(username) && !blockedSet.has(username);
  });

  const visibleItems = blockedFilteredItems.filter((item) => {
    if (isOwnSearchUser(item, viewerIdentity)) return false;
    return isSearchUserVisible(item, {
      excludeFollowedContent,
      followingUsernames,
      viewerUsername: viewerIdentity.username,
    });
  });
  return visibleItems;
}
