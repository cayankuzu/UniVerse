import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth";
import {
  hasAnyPermissionGranted,
  persistPermissionSnapshot,
  persistPermissionPromptPreference,
  readPermissionSnapshot,
  readPermissionPromptPreference,
} from "../data/onboardingStorage";
import type { OnboardingContextType, PermissionSnapshot } from "./runtime";

export function useOnboardingProviderState(): OnboardingContextType {
  const { isDemoMode, isLoggedIn, userData } = useAuth();
  const [hasPermissions, setHasPermissions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const promptHandledForSessionRef = useRef("");
  const currentUserId = String(userData.id || "").trim();

  const syncStoredPermissions = useCallback(async () => {
    const snapshot = await readPermissionSnapshot();
    setHasPermissions(snapshot ? hasAnyPermissionGranted(snapshot) : false);
    return snapshot;
  }, []);

  useEffect(() => {
    void syncStoredPermissions();
  }, [syncStoredPermissions]);

  useEffect(() => {
    if (!isLoggedIn || isDemoMode || !currentUserId) {
      promptHandledForSessionRef.current = "";
      setShowPermissions(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const suppressPrompt = await readPermissionPromptPreference(currentUserId);
      const storedSnapshot = await syncStoredPermissions();
      if (cancelled) return;
      const hasGrantedPermissions = storedSnapshot
        ? hasAnyPermissionGranted(storedSnapshot)
        : false;
      if (storedSnapshot) {
        setHasPermissions(hasGrantedPermissions);
      }
      if (
        suppressPrompt ||
        promptHandledForSessionRef.current === currentUserId ||
        hasGrantedPermissions
      ) {
        setShowPermissions(false);
        return;
      }
      promptHandledForSessionRef.current = currentUserId;
      setShowPermissions(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isDemoMode, isLoggedIn, syncStoredPermissions]);

  const grantPermissions = useCallback(
    async (snapshot?: PermissionSnapshot, options?: { suppressPrompt?: boolean }) => {
      const nextSnapshot = await persistPermissionSnapshot(snapshot);
      if (currentUserId) {
        await persistPermissionPromptPreference({
          suppressPrompt: Boolean(options?.suppressPrompt),
          userId: currentUserId,
        });
        promptHandledForSessionRef.current = currentUserId;
      }
      setHasPermissions(hasAnyPermissionGranted(nextSnapshot));
      setShowPermissions(false);
    },
    [currentUserId],
  );

  return useMemo(
    () => ({
      grantPermissions,
      hasPermissions,
      showPermissions,
    }),
    [grantPermissions, hasPermissions, showPermissions],
  );
}
