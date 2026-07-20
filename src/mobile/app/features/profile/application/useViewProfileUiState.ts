import { startTransition, useCallback, useEffect, useState } from "react";
import type { AlbumOwnerFilter, ProfileTab } from "../domain/profileConstants";

export function useViewProfileUiState(username: string) {
  const [tab, setTabState] = useState<ProfileTab>("album");
  const [albumOwnerFilter, setAlbumOwnerFilter] = useState<AlbumOwnerFilter>("all");
  const [albumOwnerFilterExpanded, setAlbumOwnerFilterExpanded] = useState(false);

  useEffect(() => {
    setAlbumOwnerFilter("all");
    setAlbumOwnerFilterExpanded(false);
    startTransition(() => {
      setTabState("album");
    });
  }, [username]);

  const setTab = useCallback((nextTab: ProfileTab) => {
    setTabState(nextTab);
  }, []);

  return {
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    setTab,
    tab,
  };
}
