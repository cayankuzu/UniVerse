import type { Session } from "@supabase/supabase-js";
import { useCallback } from "react";
import { DEMO_MODE_ENABLED } from "../../../platform/config/runtime";
import { queryClient } from "../../../data/query/queryClient";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { PersistedAuthSnapshot } from "../../../platform/storage/authSession";
import { getSeededAuthStateFromSession } from "./authSessionSeed";
import { persistResolvedAuthSnapshot, persistSeededSessionState } from "./authSessionSupport";
import { buildDemoAuthState } from "./authFixtureSeed";
import {
  EMPTY_AUTH_USER_DATA,
  persistDemoAuthStateBestEffort,
} from "./useAuthSessionLifecycle.helpers";
import type { AuthBootState } from "./authContext.shared";
import type { UseAuthSessionLifecycleParams } from "./useAuthSessionLifecycle.types";

type UseAuthSessionStateActionsParams = Pick<
  UseAuthSessionLifecycleParams,
  | "accountType"
  | "hydratedSessionKey"
  | "isDemoRef"
  | "setAccountType"
  | "setAuthBootState"
  | "setBlockedUsers"
  | "setIsDemoMode"
  | "setIsLoading"
  | "setIsLoggedIn"
  | "setIsPrivateAccountState"
  | "setPendingVerification"
  | "setUserData"
> & {
  lastSeededSessionAtRef: React.MutableRefObject<number>;
};

export function useAuthSessionStateActions({
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
}: UseAuthSessionStateActionsParams) {
  const seedAuthStateFromSession = useCallback(
    (session: Session) => {
      const seededAuthState = getSeededAuthStateFromSession(session);

      lastSeededSessionAtRef.current = Date.now();
      isDemoRef.current = false;
      setIsDemoMode(false);
      setAccountType(seededAuthState.accountType);
      setBlockedUsers([]);
      setPendingVerification(null);
      setUserData(seededAuthState.userData);
      setIsPrivateAccountState(seededAuthState.isPrivateAccount);
      setIsLoggedIn(true);
      setAuthBootState("signed_in_seeded");
      void persistSeededSessionState(session);
    },
    [
      isDemoRef,
      lastSeededSessionAtRef,
      setAccountType,
      setAuthBootState,
      setBlockedUsers,
      setIsDemoMode,
      setIsLoggedIn,
      setIsPrivateAccountState,
      setPendingVerification,
      setUserData,
    ],
  );

  const seedAuthStateFromSnapshot = useCallback(
    (snapshot: PersistedAuthSnapshot) => {
      lastSeededSessionAtRef.current = Date.now();
      isDemoRef.current = false;
      setIsDemoMode(false);
      setAccountType(snapshot.accountType);
      setBlockedUsers([]);
      setPendingVerification(null);
      setUserData(snapshot.userData);
      setIsPrivateAccountState(snapshot.isPrivateAccount);
      setIsLoggedIn(true);
      setAuthBootState("signed_in_seeded");
    },
    [
      isDemoRef,
      lastSeededSessionAtRef,
      setAccountType,
      setAuthBootState,
      setBlockedUsers,
      setIsDemoMode,
      setIsLoggedIn,
      setIsPrivateAccountState,
      setPendingVerification,
      setUserData,
    ],
  );

  const applyDemoState = useCallback(
    (type: "student" | "club") => {
      const next = buildDemoAuthState(type);
      isDemoRef.current = true;
      hydratedSessionKey.current = `demo:${type}`;
      setIsDemoMode(true);
      setAccountType(next.accountType);
      setUserData(next.userData);
      setIsPrivateAccountState(Boolean(next.userData.isPrivate));
      setBlockedUsers([]);
      setIsLoggedIn(true);
      setAuthBootState("signed_in_hydrated");
    },
    [
      hydratedSessionKey,
      isDemoRef,
      setAccountType,
      setAuthBootState,
      setBlockedUsers,
      setIsDemoMode,
      setIsLoggedIn,
      setIsPrivateAccountState,
      setUserData,
    ],
  );

  const clearAuthState = useCallback(
    (opts?: { keepLoading?: boolean; nextBootState?: AuthBootState }) => {
      isDemoRef.current = false;
      hydratedSessionKey.current = "";
      queryClient.clear();
      setIsDemoMode(false);
      setAccountType("student");
      setIsLoggedIn(false);
      setAuthBootState(opts?.nextBootState ?? "signed_out");
      setUserData({ ...EMPTY_AUTH_USER_DATA });
      setIsPrivateAccountState(false);
      setBlockedUsers([]);
      setPendingVerification(null);
      if (!opts?.keepLoading) {
        setIsLoading(false);
      }
    },
    [
      hydratedSessionKey,
      isDemoRef,
      setAccountType,
      setAuthBootState,
      setBlockedUsers,
      setIsDemoMode,
      setIsLoading,
      setIsLoggedIn,
      setIsPrivateAccountState,
      setPendingVerification,
      setUserData,
    ],
  );

  const updateUserData = useCallback(
    (data: Partial<AuthUserData>) => {
      setUserData((prev) => {
        const nextUserData = { ...prev, ...data };
        void persistResolvedAuthSnapshot({
          accountType,
          isPrivateAccount: accountType === "club" ? false : Boolean(nextUserData.isPrivate),
          userData: nextUserData,
        });
        return nextUserData;
      });
    },
    [accountType, setUserData],
  );

  const setIsPrivateAccount = useCallback(
    (value: boolean) => {
      const nextValue = accountType === "club" ? false : value;
      setIsPrivateAccountState(nextValue);
      setUserData((prev) => {
        const nextUserData = { ...prev, isPrivate: nextValue };
        void persistResolvedAuthSnapshot({
          accountType,
          isPrivateAccount: nextValue,
          userData: nextUserData,
        });
        return nextUserData;
      });
    },
    [accountType, setIsPrivateAccountState, setUserData],
  );

  const loginAsDemo = useCallback(
    (type: "student" | "club") => {
      if (!DEMO_MODE_ENABLED) return;
      queryClient.clear();
      applyDemoState(type);
      persistDemoAuthStateBestEffort(type, buildDemoAuthState(type).userData, "manual-demo-login");
      setIsLoading(false);
    },
    [applyDemoState, setIsLoading],
  );

  return {
    applyDemoState,
    clearAuthState,
    loginAsDemo,
    seedAuthStateFromSession,
    seedAuthStateFromSnapshot,
    setIsPrivateAccount,
    updateUserData,
  };
}
