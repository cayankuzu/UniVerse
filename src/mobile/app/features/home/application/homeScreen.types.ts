import type { AuthUserData } from "../../../data/contracts/entities";

export type HomeViewerData = {
  accountType?: "club" | "student";
  id?: string;
  username: string;
};

export interface UseHomeScreenStateParams {
  accountType: "club" | "student";
  blockedUsers?: string[];
  homeReselectCounter: number;
  userData: AuthUserData;
}
