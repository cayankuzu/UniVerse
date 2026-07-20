import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { ProjectionQueryOptions } from "../../../data/projections/contracts";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";

type ProfileProjectionItem = AlbumPhotoWithMeta | EventWithMeta;

type Params = {
  albumDef: ProjectionQueryOptions<ProfileProjectionItem>;
  enabled: boolean;
  eventDef: ProjectionQueryOptions<ProfileProjectionItem>;
  tab: ProfileContentTab;
};

export function useProfileContentProjections({ albumDef, enabled, eventDef, tab }: Params) {
  const albumProjection = useProjectionScreen<ProfileProjectionItem>({
    ...albumDef,
    autoRefreshOnFocus: false,
    enabled,
  });
  const eventProjection = useProjectionScreen<ProfileProjectionItem>({
    ...eventDef,
    autoRefreshOnFocus: false,
    enabled,
  });

  return {
    activeProjection: tab === "album" ? albumProjection : eventProjection,
    albumProjection,
    eventProjection,
  };
}
