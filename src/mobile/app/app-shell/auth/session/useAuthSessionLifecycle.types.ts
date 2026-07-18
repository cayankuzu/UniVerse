import type { AccountType } from "../../../data/contracts/api";
import type { PendingVerification } from "../../../data/contracts/auth";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { AuthBootState } from "./authContext.shared";

export type UseAuthSessionLifecycleParams = {
  accountType: AccountType;
  activeHydrationKeyRef: React.MutableRefObject<string>;
  activeHydrationPromiseRef: React.MutableRefObject<Promise<void> | null>;
  clearDemoStorage: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  hydratedSessionKey: React.MutableRefObject<string>;
  isDemoRef: React.MutableRefObject<boolean>;
  isLoading: boolean;
  refreshBlocked: () => Promise<void>;
  setAccountType: React.Dispatch<React.SetStateAction<AccountType>>;
  setAuthBootState: React.Dispatch<React.SetStateAction<AuthBootState>>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<string[]>>;
  setIsDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPrivateAccountState: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingVerification: React.Dispatch<React.SetStateAction<PendingVerification>>;
  setUserData: React.Dispatch<React.SetStateAction<AuthUserData>>;
  suppressSignedOutRef: React.MutableRefObject<boolean>;
};
