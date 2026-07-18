import { startTransition, useEffect, useState } from "react";
import { useTransitionSetter } from "../../../shared/hooks/useTransitionSetter";
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

  const setTab = useTransitionSetter<ProfileTab>(setTabState);

  return {
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    setTab,
    tab,
  };
}
