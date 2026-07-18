import { useCallback } from "react";
import type { ProfileTileItem } from "../application/profileUiModels";

type UseOwnProfileScreenActionsParams = {
  albums: Array<{ id?: string }>;
  events: Array<{ id?: string }>;
  loadMore: () => Promise<unknown> | unknown;
  loadingMore: boolean;
  openProfile: (username: string) => void;
  setViewerIndex: (value: number) => void;
  setViewerTargetId: (value: string | null) => void;
  setViewerType: (value: "events" | "albums" | null) => void;
};

export function useOwnProfileScreenActions(params: UseOwnProfileScreenActionsParams) {
  const {
    albums,
    events,
    loadMore,
    loadingMore,
    openProfile,
    setViewerIndex,
    setViewerTargetId,
    setViewerType,
  } = params;
  const openAlbumAt = useCallback(
    (item: ProfileTileItem) => {
      const targetId = String(item?.id || "").trim();
      const targetIndex = albums.findIndex((album) => album.id === targetId);
      if (!targetId || targetIndex < 0) return;
      setViewerTargetId(targetId);
      setViewerType("albums");
      setViewerIndex(targetIndex);
    },
    [albums, setViewerIndex, setViewerTargetId, setViewerType],
  );
  const openEventAt = useCallback(
    (item: ProfileTileItem) => {
      const targetId = String(item?.id || "").trim();
      const targetIndex = events.findIndex((event) => event.id === targetId);
      if (!targetId || targetIndex < 0) return;
      setViewerTargetId(targetId);
      setViewerType("events");
      setViewerIndex(targetIndex);
    },
    [events, setViewerIndex, setViewerTargetId, setViewerType],
  );
  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    void loadMore();
  }, [loadMore, loadingMore]);
  const openContentProfile = useCallback(
    (username: string) => {
      openProfile(username);
    },
    [openProfile],
  );

  return {
    handleLoadMore,
    openAlbumAt,
    openContentProfile,
    openEventAt,
  };
}
