import type { QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthAPI } from "../../../data/auth";
import { persistResolvedAuthSnapshot } from "./authSessionSupport";
import { applyAuthViewerCachePolicy } from "./authCachePolicy";
import {
  DEMO_DATA_KEY,
  DEMO_MODE_KEY,
  type AuthBootState,
  defaultUserData,
  profileToUserData,
  type PendingVerification,
} from "./authContext.shared";
import { normalizeUsername } from "./authHelpers";

interface UseAuthProviderStateParams {
  queryClient: QueryClient;
}

export function useAuthProviderState({ queryClient }: UseAuthProviderStateParams) {
  const [authBootState, setAuthBootState] = useState<AuthBootState>("booting");
  const [accountType, setAccountType] = useState<"student" | "club">("student");
  const [userData, setUserData] = useState(defaultUserData);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification>(null);
  const [isPrivateAccount, setIsPrivateAccountState] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const hydratedSessionKey = useRef("");
  const repairedViewerCacheKeyRef = useRef("");
  const isDemoRef = useRef(false);
  const suppressSignedOutRef = useRef(false);
  const activeHydrationPromiseRef = useRef<Promise<void> | null>(null);
  const activeHydrationKeyRef = useRef("");
  const blockedUsersRef = useRef(blockedUsers);
  const latestAuthSnapshotRef = useRef({
    isLoggedIn,
    userData,
  });

  useEffect(() => {
    latestAuthSnapshotRef.current = {
      isLoggedIn,
      userData,
    };
  }, [isLoggedIn, userData]);

  useEffect(() => {
    blockedUsersRef.current = blockedUsers;
  }, [blockedUsers]);

  const fetchProfile = useCallback(async () => {
    if (isDemoRef.current) return;
    const currentAuthSnapshot = latestAuthSnapshotRef.current;
    const profile = await AuthAPI.getMe({
      allowHardSignOut: false,
      includeMetrics: false,
      recoverSessionOnUnauthorized: false,
    });
    const nextUserData = profileToUserData(profile);
    const cachePolicy = applyAuthViewerCachePolicy(queryClient, {
      currentUserData: currentAuthSnapshot.userData,
      isLoggedIn: currentAuthSnapshot.isLoggedIn,
      nextUserData,
      repairedViewerCacheKey: repairedViewerCacheKeyRef.current,
    });
    repairedViewerCacheKeyRef.current = cachePolicy.nextRepairedViewerCacheKey;

    setUserData(nextUserData);
    setAccountType(profile.accountType === "club" ? "club" : "student");
    setIsPrivateAccountState(profile.accountType === "club" ? false : (profile.isPrivate ?? false));
    setIsLoggedIn(true);
    setAuthBootState("signed_in_hydrated");
    void persistResolvedAuthSnapshot({
      accountType: profile.accountType === "club" ? "club" : "student",
      isPrivateAccount: profile.accountType === "club" ? false : (profile.isPrivate ?? false),
      userData: nextUserData,
    });
  }, [queryClient]);

  const clearDemoStorage = useCallback(async () => {
    await AsyncStorage.multiRemove([DEMO_MODE_KEY, DEMO_DATA_KEY]);
  }, []);

  const isBlocked = useCallback(
    (username: string) => blockedUsers.includes(normalizeUsername(username)),
    [blockedUsers],
  );

  return {
    accountType,
    activeHydrationKeyRef,
    activeHydrationPromiseRef,
    authBootState,
    blockedUsers,
    blockedUsersRef,
    clearDemoStorage,
    fetchProfile,
    hydratedSessionKey,
    isAuthBootstrapPending: authBootState === "booting",
    isBlocked,
    isDemoMode,
    isDemoRef,
    isLoading,
    isLoggedIn,
    isPrivateAccount,
    pendingVerification,
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
    userData,
  };
}
