import { useMemo } from "react";
import type { AuthContextType } from "./authContext.shared";
import type { useAuthProviderState } from "./useAuthProviderState";
import type { useAuthSessionLifecycle } from "./useAuthSessionLifecycle";
import type { useAuthSocialState } from "./useAuthSocialState";

type AuthRuntimeValueParams = {
  authState: ReturnType<typeof useAuthProviderState>;
  session: ReturnType<typeof useAuthSessionLifecycle>;
  social: ReturnType<typeof useAuthSocialState>;
};

export function useAuthContextValue({ authState, session, social }: AuthRuntimeValueParams) {
  return useMemo<AuthContextType>(
    () => ({
      accountType: authState.accountType,
      authBootState: authState.authBootState,
      blockedUsers: authState.blockedUsers,
      blockUser: social.blockUser,
      deleteAccount: session.deleteAccount,
      isAuthBootstrapPending: authState.isAuthBootstrapPending,
      isBlocked: authState.isBlocked,
      isDemoMode: authState.isDemoMode,
      isLoading: authState.isLoading,
      isLoggedIn: authState.isLoggedIn,
      isPrivateAccount: authState.isPrivateAccount,
      login: session.login,
      loginAsDemo: session.loginAsDemo,
      logout: session.logout,
      pendingVerification: authState.pendingVerification,
      setIsPrivateAccount: session.setIsPrivateAccount,
      setPendingVerification: authState.setPendingVerification,
      unblockUser: social.unblockUser,
      updateUserData: session.updateUserData,
      userData: authState.userData,
    }),
    [
      authState.accountType,
      authState.authBootState,
      authState.blockedUsers,
      authState.isAuthBootstrapPending,
      authState.isBlocked,
      authState.isDemoMode,
      authState.isLoading,
      authState.isLoggedIn,
      authState.isPrivateAccount,
      authState.pendingVerification,
      authState.setPendingVerification,
      authState.userData,
      session.deleteAccount,
      session.login,
      session.loginAsDemo,
      session.logout,
      session.setIsPrivateAccount,
      session.updateUserData,
      social.blockUser,
      social.unblockUser,
    ],
  );
}
