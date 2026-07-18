import { debugLog } from "../../../platform/logging/logger";

type SearchLogState = {
  hasSearchIntent: boolean;
  query: string;
  selectedCategory: string;
  selectedFee: "" | "free" | "paid";
  selectedUniversity: string;
  sortOption: string;
  type: string;
};

export function logSearchCounts(params: {
  filteredCounts: {
    albums: number;
    clubs: number;
    events: number;
    students: number;
  };
  rawCounts: {
    albums: number;
    clubs: number;
    events: number;
    students: number;
  };
  searchState: SearchLogState;
  nextCursor?: string | null;
}) {
  debugLog("SEARCH", "counts", {
    filteredAlbums: params.filteredCounts.albums,
    filteredClubs: params.filteredCounts.clubs,
    filteredEvents: params.filteredCounts.events,
    filteredStudents: params.filteredCounts.students,
    hasSearchIntent: params.searchState.hasSearchIntent,
    nextCursor: params.nextCursor || null,
    query: params.searchState.query,
    rawAlbums: params.rawCounts.albums,
    rawClubs: params.rawCounts.clubs,
    rawEvents: params.rawCounts.events,
    rawStudents: params.rawCounts.students,
    selectedCategory: params.searchState.selectedCategory,
    selectedFee: params.searchState.selectedFee,
    selectedUniversity: params.searchState.selectedUniversity,
    sortOption: params.searchState.sortOption,
    type: params.searchState.type,
  });
}
