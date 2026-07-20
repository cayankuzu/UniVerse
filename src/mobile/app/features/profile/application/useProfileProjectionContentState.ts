import { useMemo } from "react";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { sanitizeProfileAlbums, sanitizeProfileEvents } from "./profileCollections";

type Params = {
  albumItems: Array<AlbumPhotoWithMeta | EventWithMeta>;
  enabled: boolean;
  eventItems: Array<AlbumPhotoWithMeta | EventWithMeta>;
};

const EMPTY_PROFILE_CONTENT: never[] = [];

export function useProfileProjectionContentState({ albumItems, enabled, eventItems }: Params) {
  const sourceAlbums = useMemo(
    () =>
      enabled ? sanitizeProfileAlbums(albumItems as AlbumPhotoWithMeta[]) : EMPTY_PROFILE_CONTENT,
    [albumItems, enabled],
  );
  const sourceEvents = useMemo(
    () => (enabled ? sanitizeProfileEvents(eventItems as EventWithMeta[]) : EMPTY_PROFILE_CONTENT),
    [enabled, eventItems],
  );

  return {
    sourceAlbums,
    sourceEvents,
  };
}
