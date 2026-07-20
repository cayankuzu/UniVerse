import { useMemo, useRef } from "react";
import { hardSignOut } from "../../../data/security/authSessionBoundary";
import type { AuthContextType } from "./authContext.shared";
import { createDeleteAccountHandler, createLogoutHandler } from "./useAuthSessionLifecycle.actions";
import { createLoginHandler } from "./useAuthSessionLifecycle.login";
import { useAuthBootTimeout } from "./useAuthBootTimeout";
import { getPersistedAuthBootstrapSnapshot } from "./authSessionSupport";
import { useAuthBootstrapInit, useAuthSessionSubscription } from "./useAuthSessionEffects";
import { useAuthSessionHydration } from "./useAuthSessionHydration";
import { confirmPersistedSession } from "./useAuthSessionLifecycle.helpers";
import { useAuthSessionStateActions } from "./useAuthSessionStateActions";
import type { UseAuthSessionLifecycleParams } from "./useAuthSessionLifecycle.types";

export function useAuthSessionLifecycle({
  accountType,
  activeHydrationKeyRef,
  activeHydrationPromiseRef,
  clearDemoStorage,
  fetchProfile,
  hydratedSessionKey,
  isDemoRef,
  isLoading,
  refreshBlocked,
  setAccountType,
  setAuthBootState,
  setBlockedUsers,
  setIsDemoMode,
  setIsLoading,
  setIsLoggedIn,
  setIsPrivateAccountState,
  setPendingVerification,
  setUserData,
  suppressSignedOutRef,
}: UseAuthSessionLifecycleParams) {
  const lastSeededSessionAtRef = useRef(0);
  const {
    applyDemoState,
    clearAuthState,
    loginAsDemo,
    seedAuthStateFromSnapshot,
    seedAuthStateFromSession,
    setIsPrivateAccount,
    updateUserData,
  } = useAuthSessionStateActions({
    accountType,
    hydratedSessionKey,
    isDemoRef,
    lastSeededSessionAtRef,
    setAccountType,
    setAuthBootState,
    setBlockedUsers,
    setIsDemoMode,
    setIsLoading,
    setIsLoggedIn,
    setIsPrivateAccountState,
    setPendingVerification,
    setUserData,
  });
  const {
    recoverAndHydrateSession,
    releaseSignedOutSuppression,
    startSessionHydrationInBackground,
  } = useAuthSessionHydration({
    activeHydrationKeyRef,
    activeHydrationPromiseRef,
    fetchProfile,
    hydratedSessionKey,
    isDemoRef,
    refreshBlocked,
    seedAuthStateFromSession,
    suppressSignedOutRef,
  });

  useAuthBootstrapInit({
    applyDemoState,
    clearAuthState,
    clearDemoStorage,
    getPersistedAuthBootstrapSnapshot,
    isDemoRef,
    seedAuthStateFromSnapshot,
    setAuthBootState,
    setIsLoading,
    startSessionHydrationInBackground,
  });

  useAuthSessionSubscription({
    clearAuthState,
    confirmPersistedSession,
    isDemoRef,
    lastSeededSessionAtRef,
    recoverAndHydrateSession,
    startSessionHydrationInBackground,
    suppressSignedOutRef,
  });

  useAuthBootTimeout({ clearAuthState, isLoading });

  const login = useMemo(
    () =>
      createLoginHandler({
        applyDemoState,
        clearAuthState,
        recoverAndHydrateSession,
        releaseSignedOutSuppression,
        setIsLoading,
        startSessionHydrationInBackground,
        suppressSignedOutRef,
      }),
    [
      applyDemoState,
      clearAuthState,
      recoverAndHydrateSession,
      releaseSignedOutSuppression,
      setIsLoading,
      startSessionHydrationInBackground,
      suppressSignedOutRef,
    ],
  );

  const logout = useMemo(
    () =>
      createLogoutHandler({
        clearAuthState,
        clearDemoStorage,
        isDemoRef,
        signOut: () => hardSignOut("logout"),
        suppressSignedOutRef,
      }),
    [clearAuthState, clearDemoStorage, isDemoRef, suppressSignedOutRef],
  );

  const deleteAccount = useMemo(
    () =>
      createDeleteAccountHandler({
        clearAuthState,
        clearDemoStorage,
        isDemoRef,
        logout,
        signOut: () => hardSignOut("delete-account"),
      }),
    [clearAuthState, clearDemoStorage, isDemoRef, logout],
  );

  return {
    clearAuthState,
    deleteAccount,
    login,
    loginAsDemo,
    logout,
    setIsPrivateAccount,
    updateUserData,
  } satisfies Pick<
    AuthContextType,
    "deleteAccount" | "login" | "loginAsDemo" | "logout" | "setIsPrivateAccount" | "updateUserData"
  > & { clearAuthState: (opts?: { keepLoading?: boolean }) => void };
}
