import type {
  AlbumPhotoWithMeta,
  EventWithMeta,
  RelationSnapshot,
  SearchUserResult,
} from "../data";
import { collectRelationClubUsernames } from "../domain/searchResults.helpers";
import { filterSearchAlbums, filterSearchEvents, filterSearchUsers } from "./searchFiltering";
import { normalize } from "../domain/searchHelpers";
import type { SearchType } from "../domain/types";

export type ViewerIdentity = {
  userId?: string;
  username: string;
};

type SearchProjectionItem = EventWithMeta | AlbumPhotoWithMeta | SearchUserResult;

type SearchRawCollections = {
  rawAlbums: AlbumPhotoWithMeta[];
  rawClubs: SearchUserResult[];
  rawEvents: EventWithMeta[];
  rawStudents: SearchUserResult[];
};

export function resolveSearchRawCollections(params: {
  searchProjectionItemsByType?: Record<SearchType, SearchProjectionItem[]>;
}): SearchRawCollections {
  const projectionItems = params.searchProjectionItemsByType;

  return {
    rawAlbums: (projectionItems?.albums || []) as AlbumPhotoWithMeta[],
    rawClubs: (projectionItems?.clubs || []) as SearchUserResult[],
    rawEvents: (projectionItems?.events || []) as EventWithMeta[],
    rawStudents: (projectionItems?.students || []) as SearchUserResult[],
  };
}

export function buildBlockedSet(blockedUsers?: string[]) {
  return new Set((blockedUsers || []).map((item) => normalize(item)).filter(Boolean));
}

export function resolveRelationByClub(params: {
  buildRelationByClub: (clubUsernames: string[]) => Record<string, RelationSnapshot>;
  rawAlbums: AlbumPhotoWithMeta[];
  rawEvents: EventWithMeta[];
}) {
  const relationClubUsernames = collectRelationClubUsernames(params.rawEvents, params.rawAlbums);
  return params.buildRelationByClub(relationClubUsernames);
}

export function resolveFilteredSearchCollections(params: {
  blockedSet: Set<string>;
  excludeFollowedContent?: boolean;
  followingClubUsernames: Set<string>;
  followingUsernames: Set<string>;
  rawAlbums: AlbumPhotoWithMeta[];
  rawClubs: SearchUserResult[];
  rawEvents: EventWithMeta[];
  rawStudents: SearchUserResult[];
  viewerIdentity: ViewerIdentity;
}) {
  const {
    blockedSet,
    excludeFollowedContent,
    followingClubUsernames,
    followingUsernames,
    rawAlbums,
    rawClubs,
    rawEvents,
    rawStudents,
    viewerIdentity,
  } = params;

  return {
    filteredAlbums: filterSearchAlbums({
      blockedSet,
      excludeFollowedContent,
      followingClubUsernames,
      followingUsernames,
      items: rawAlbums,
      viewerIdentity,
    }),
    filteredClubs: filterSearchUsers({
      blockedSet,
      excludeFollowedContent,
      followingUsernames,
      items: rawClubs,
      viewerIdentity,
    }),
    filteredEvents: filterSearchEvents({
      blockedSet,
      excludeFollowedContent,
      followingClubUsernames,
      followingUsernames,
      items: rawEvents,
      viewerIdentity,
    }),
    filteredStudents: filterSearchUsers({
      blockedSet,
      excludeFollowedContent,
      followingUsernames,
      items: rawStudents,
      viewerIdentity,
    }),
  };
}

export function resolveActiveSearchItems(params: {
  filteredAlbums: AlbumPhotoWithMeta[];
  filteredClubs: SearchUserResult[];
  filteredEvents: EventWithMeta[];
  filteredStudents: SearchUserResult[];
  type: SearchType;
}) {
  const { filteredAlbums, filteredClubs, filteredEvents, filteredStudents, type } = params;
  return (
    type === "events"
      ? filteredEvents
      : type === "albums"
        ? filteredAlbums
        : type === "clubs"
          ? filteredClubs
          : filteredStudents
  ) as unknown[];
}
