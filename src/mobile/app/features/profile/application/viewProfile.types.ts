import type { AuthUserData } from "../../../data/contracts/entities";

export interface UseViewProfileParams {
  accountType: "club" | "student" | null | undefined;
  blockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<unknown>;
  blockedUsers: string[];
  isBlocked: (username: string) => boolean;
  unblockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<unknown>;
  userData: AuthUserData;
  username: string;
}

export interface UseViewProfileOptions {
  onWarningMessage?: (message: string | null) => void;
}
