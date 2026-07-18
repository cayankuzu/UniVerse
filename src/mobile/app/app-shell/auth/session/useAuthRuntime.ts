import { useQueryClient } from "@tanstack/react-query";
import { useAuthProviderState } from "./useAuthProviderState";
import { useAuthSessionLifecycle } from "./useAuthSessionLifecycle";
import { useAuthSocialState } from "./useAuthSocialState";

export function useAuthRuntime() {
  const queryClient = useQueryClient();
  const authState = useAuthProviderState({ queryClient });

  const social = useAuthSocialState({
    blockedUsersRef: authState.blockedUsersRef,
    isDemoRef: authState.isDemoRef,
    setBlockedUsers: authState.setBlockedUsers,
  });

  const session = useAuthSessionLifecycle({
    accountType: authState.accountType,
    activeHydrationKeyRef: authState.activeHydrationKeyRef,
    activeHydrationPromiseRef: authState.activeHydrationPromiseRef,
    clearDemoStorage: authState.clearDemoStorage,
    fetchProfile: authState.fetchProfile,
    hydratedSessionKey: authState.hydratedSessionKey,
    isDemoRef: authState.isDemoRef,
    isLoading: authState.isLoading,
    refreshBlocked: social.refreshBlocked,
    setAccountType: authState.setAccountType,
    setAuthBootState: authState.setAuthBootState,
    setBlockedUsers: authState.setBlockedUsers,
    setIsDemoMode: authState.setIsDemoMode,
    setIsLoading: authState.setIsLoading,
    setIsLoggedIn: authState.setIsLoggedIn,
    setIsPrivateAccountState: authState.setIsPrivateAccountState,
    setPendingVerification: authState.setPendingVerification,
    setUserData: authState.setUserData,
    suppressSignedOutRef: authState.suppressSignedOutRef,
  });

  return {
    authState,
    session,
    social,
  };
}
