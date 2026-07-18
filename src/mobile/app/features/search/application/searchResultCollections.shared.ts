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
  searchProjectionItems?: SearchProjectionItem[];
  type: SearchType;
}): SearchRawCollections {
  const { searchProjectionItems, type } = params;
  const projectionItems = searchProjectionItems || [];

  return {
    rawAlbums: type === "albums" ? (projectionItems as AlbumPhotoWithMeta[]) : [],
    rawClubs: type === "clubs" ? (projectionItems as SearchUserResult[]) : [],
    rawEvents: type === "events" ? (projectionItems as EventWithMeta[]) : [],
    rawStudents: type === "students" ? (projectionItems as SearchUserResult[]) : [],
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
