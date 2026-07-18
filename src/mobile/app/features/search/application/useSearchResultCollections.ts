import { useMemo } from "react";
import type {
  AlbumPhotoWithMeta,
  EventWithMeta,
  RelationSnapshot,
  SearchUserResult,
} from "../data";
import {
  buildBlockedSet,
  resolveActiveSearchItems,
  resolveFilteredSearchCollections,
  resolveRelationByClub,
  resolveSearchRawCollections,
  type ViewerIdentity,
} from "./searchResultCollections.shared";
import type { SearchType } from "../domain/types";

export function useSearchResultCollections(params: {
  blockedUsers?: string[];
  buildRelationByClub: (clubUsernames: string[]) => Record<string, RelationSnapshot>;
  excludeFollowedContent?: boolean;
  followingClubUsernames: Set<string>;
  followingUsernames: Set<string>;
  searchProjectionItems?: Array<EventWithMeta | AlbumPhotoWithMeta | SearchUserResult>;
  searchType: SearchType;
  viewerIdentity: ViewerIdentity;
}) {
  const {
    blockedUsers,
    buildRelationByClub,
    excludeFollowedContent,
    followingClubUsernames,
    followingUsernames,
    searchProjectionItems,
    searchType,
    viewerIdentity,
  } = params;

  const { rawAlbums, rawClubs, rawEvents, rawStudents } = useMemo(
    () =>
      resolveSearchRawCollections({
        searchProjectionItems,
        type: searchType,
      }),
    [searchProjectionItems, searchType],
  );

  const blockedSet = useMemo(() => buildBlockedSet(blockedUsers), [blockedUsers]);

  const relationByClub = useMemo(
    () =>
      resolveRelationByClub({
        buildRelationByClub,
        rawAlbums,
        rawEvents,
      }),
    [buildRelationByClub, rawAlbums, rawEvents],
  );

  const { filteredAlbums, filteredClubs, filteredEvents, filteredStudents } = useMemo(
    () =>
      resolveFilteredSearchCollections({
        blockedSet,
        excludeFollowedContent,
        followingClubUsernames,
        followingUsernames,
        rawAlbums,
        rawClubs,
        rawEvents,
        rawStudents,
        viewerIdentity,
      }),
    [
      blockedSet,
      excludeFollowedContent,
      followingClubUsernames,
      followingUsernames,
      rawAlbums,
      rawClubs,
      rawEvents,
      rawStudents,
      viewerIdentity,
    ],
  );

  const activeSearchItems = useMemo(
    () =>
      resolveActiveSearchItems({
        filteredAlbums,
        filteredClubs,
        filteredEvents,
        filteredStudents,
        type: searchType,
      }),
    [filteredAlbums, filteredClubs, filteredEvents, filteredStudents, searchType],
  );

  return {
    activeSearchItems,
    filteredAlbums,
    filteredClubs,
    filteredEvents,
    filteredStudents,
    rawAlbums,
    rawClubs,
    rawEvents,
    rawStudents,
    relationByClub,
  };
}
