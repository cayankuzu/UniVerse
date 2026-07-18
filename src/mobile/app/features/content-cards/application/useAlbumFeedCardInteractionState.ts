import type { AlbumPhotoWithMeta } from "../data";
import type { ContentViewer } from "../data";
import { useAlbumPhotoInteractionState } from "./useAlbumPhotoInteractionState";

interface UseAlbumFeedCardInteractionStateParams {
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  showLikesModal: boolean;
  userData: ContentViewer;
}

export function useAlbumFeedCardInteractionState(params: UseAlbumFeedCardInteractionStateParams) {
  return useAlbumPhotoInteractionState({
    ...params,
    telemetryPrefix: "album_card_modal",
  });
}
