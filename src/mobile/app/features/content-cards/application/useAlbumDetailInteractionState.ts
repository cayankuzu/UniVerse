import type { AuthUserData } from "../../../data/contracts/entities";
import type { AlbumPhotoWithMeta } from "../data";
import { useAlbumPhotoInteractionState } from "./useAlbumPhotoInteractionState";

interface UseAlbumDetailInteractionStateParams {
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  showLikesModal: boolean;
  userData: AuthUserData;
}

export function useAlbumDetailInteractionState({
  onShowWarning,
  photo,
  showLikesModal,
  userData,
}: UseAlbumDetailInteractionStateParams) {
  return useAlbumPhotoInteractionState({
    onShowWarning,
    photo,
    showLikesModal,
    telemetryPrefix: "album_detail_modal",
    userData: {
      id: userData.id,
      username: userData.username,
      name: userData.name,
      clubName: userData.clubName,
      profileImage: userData.profileImage,
      university: userData.university,
    },
  });
}
