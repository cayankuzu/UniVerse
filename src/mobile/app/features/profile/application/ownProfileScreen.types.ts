import type { AuthUserData } from "../../../data/contracts/entities";

export interface UseOwnProfileScreenStateParams {
  accountType: "club" | "student";
  blockedUsers?: string[];
  onCloseViewer: () => void;
  openAlbumView: (eventId: string) => void;
  openEventDetail: (eventId: string) => void;
  openFollowers: () => void;
  openFollowing: () => void;
  openProfile: (username: string) => void;
  openSettings: () => void;
  profileReselectCounter: number;
  userData: AuthUserData;
}
