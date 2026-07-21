import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth";
import {
  hasAnyPermissionGranted,
  persistPermissionSnapshot,
  persistPermissionPromptPreference,
  readPermissionSnapshot,
} from "../data/onboardingStorage";
import type { OnboardingContextType, PermissionSnapshot } from "./runtime";

export function useOnboardingProviderState(): OnboardingContextType {
  const { isDemoMode, isLoggedIn, userData } = useAuth();
  const [hasPermissions, setHasPermissions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
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
      setShowPermissions(false);
      return;
    }
    // OS permissions are requested by the feature that needs them. Opening a
    // permission wall at app launch makes the request feel unrelated and harms
    // both trust and startup continuity.
    setShowPermissions(false);
  }, [currentUserId, isDemoMode, isLoggedIn]);

  const grantPermissions = useCallback(
    async (snapshot?: PermissionSnapshot, options?: { suppressPrompt?: boolean }) => {
      const nextSnapshot = await persistPermissionSnapshot(snapshot);
      if (currentUserId) {
        await persistPermissionPromptPreference({
          suppressPrompt: Boolean(options?.suppressPrompt),
          userId: currentUserId,
        });
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
