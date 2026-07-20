import { useMemo } from "react";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import {
  type AlbumPhotoWithMeta,
  type EventWithMeta,
  getSearchQueryDef,
  type SearchUserResult,
} from "../data";
import type { SearchType } from "../domain/types";

type SearchProjectionItem = AlbumPhotoWithMeta | EventWithMeta | SearchUserResult;
type SearchQueryDef = ReturnType<typeof getSearchQueryDef>;
type SearchQueryDefs = Record<SearchType, SearchQueryDef>;

export function useSearchProjectionScreens(queryDefs: SearchQueryDefs) {
  const albums = useProjectionScreen<SearchProjectionItem>({
    ...queryDefs.albums,
    autoRefreshOnFocus: false,
    enabled: true,
  });
  const events = useProjectionScreen<SearchProjectionItem>({
    ...queryDefs.events,
    autoRefreshOnFocus: false,
    enabled: true,
  });
  const clubs = useProjectionScreen<SearchProjectionItem>({
    ...queryDefs.clubs,
    autoRefreshOnFocus: false,
    enabled: true,
  });
  const students = useProjectionScreen<SearchProjectionItem>({
    ...queryDefs.students,
    autoRefreshOnFocus: false,
    enabled: true,
  });
  const projectionsByType = useMemo(
    () => ({ albums, clubs, events, students }),
    [albums, clubs, events, students],
  );
  const itemsByType = useMemo(
    () => ({
      albums: albums.items as AlbumPhotoWithMeta[],
      clubs: clubs.items as SearchUserResult[],
      events: events.items as EventWithMeta[],
      students: students.items as SearchUserResult[],
    }),
    [albums.items, clubs.items, events.items, students.items],
  );

  return { itemsByType, projectionsByType };
}
