import type { SearchType } from "./types";
import type { SortOption } from "./types";
import { normalize } from "./searchHelpers";

type SearchEventLike = {
  clubUsername?: string;
};

type SearchAlbumLike = {
  clubUsername?: string;
};

export const SEARCH_QUERY_MAX_LENGTH = 80;
export const SEARCH_FILTER_MAX_LENGTH = 40;

export function clampSearchValue(value: string, maxLength: number) {
  return String(value || "").slice(0, maxLength);
}

export function collectRelationClubUsernames<
  TEvent extends SearchEventLike,
  TAlbum extends SearchAlbumLike,
>(rawEvents: TEvent[], rawAlbums: TAlbum[]) {
  return Array.from(
    new Set(
      [
        ...rawEvents.map((item) => normalize(item.clubUsername || "")),
        ...rawAlbums.map((item) => normalize(item.clubUsername || "")),
      ].filter(Boolean),
    ),
  );
}

export function getActiveSearchFilterCount(params: {
  selectedCategory: string;
  selectedFee: "" | "free" | "paid";
  selectedUniversity: string;
  sortOption: SortOption;
  type: SearchType;
}) {
  const { selectedCategory, selectedFee, selectedUniversity, sortOption, type } = params;
  if (type === "albums") {
    return [sortOption !== "newest" ? sortOption : ""].filter(Boolean).length;
  }
  if (type === "events") {
    return [
      selectedCategory,
      selectedFee,
      selectedUniversity,
      sortOption !== "newest" ? sortOption : "",
    ].filter(Boolean).length;
  }
  if (type === "clubs") {
    return [selectedCategory, selectedUniversity, sortOption !== "newest" ? sortOption : ""].filter(
      Boolean,
    ).length;
  }
  return [selectedUniversity, sortOption !== "newest" ? sortOption : ""].filter(Boolean).length;
}
