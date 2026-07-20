import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AppFlatListRef } from "../../../shared/components";
import {
  getCachedWarmupPreferences,
  loadPersistedWarmupPreferences,
  persistWarmupProfileTab,
} from "../data";
import type { ProfileContentTab } from "../data";
import type { AlbumOwnerFilter, ProfileTab } from "../domain/profileConstants";

export function useOwnProfileScreenUiState(params: { viewerKey: string }) {
  const { viewerKey } = params;
  const cachedProfileTab = getCachedWarmupPreferences(viewerKey).lastProfileTab;
  const [tab, setTabState] = useState<ProfileTab>(cachedProfileTab || "album");
  const [albumOwnerFilter, setAlbumOwnerFilter] = useState<AlbumOwnerFilter>("all");
  const [albumOwnerFilterExpanded, setAlbumOwnerFilterExpanded] = useState(false);
  const listRef = useRef<AppFlatListRef<unknown> | null>(null);
  const restoredTabRef = useRef(Boolean(cachedProfileTab));

  useEffect(() => {
    if (restoredTabRef.current) return;
    let cancelled = false;
    void loadPersistedWarmupPreferences(viewerKey).then((preferences) => {
      if (cancelled) return;
      restoredTabRef.current = true;
      if (preferences.lastProfileTab === "album" || preferences.lastProfileTab === "events") {
        const nextTab = preferences.lastProfileTab;
        startTransition(() => {
          setTabState(nextTab);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewerKey]);

  useEffect(() => {
    if (!restoredTabRef.current || !tab) return;
    void persistWarmupProfileTab(viewerKey, tab as ProfileContentTab);
  }, [tab, viewerKey]);

  const setTab = useCallback((nextTab: ProfileTab) => {
    setTabState(nextTab);
  }, []);

  return {
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    listRef,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    setTab,
    tab,
  };
}
