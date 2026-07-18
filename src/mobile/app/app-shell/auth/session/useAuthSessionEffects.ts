import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { useEffect, type MutableRefObject } from "react";
import { DEMO_MODE_ENABLED } from "../../../platform/config/runtime";
import { debugWarn } from "../../../platform/logging/logger";
import { logError } from "../../../platform/observability";
import { supabase } from "../../../platform/supabase";
import { hardSignOut } from "../../../data/security/authSessionBoundary";
import type { PersistedAuthSnapshot } from "../../../platform/storage/authSession";
import { getActiveOrPersistedSession, persistAuthSession } from "./authSessionSupport";
import {
  AUTH_BOOT_SESSION_TIMEOUT_MS,
  AUTH_STORAGE_VERSION,
  AUTH_STORAGE_VERSION_KEY,
  DEMO_MODE_KEY,
  type AuthBootState,
  raceWithTimeout,
  toErrorMessage,
} from "./authContext.shared";

interface BootstrapParams {
  applyDemoState: (type: "student" | "club") => void;
  clearAuthState: (options?: { keepLoading?: boolean; nextBootState?: AuthBootState }) => void;
  clearDemoStorage: () => Promise<void>;
  getPersistedAuthBootstrapSnapshot: () => Promise<PersistedAuthSnapshot | null>;
  isDemoRef: MutableRefObject<boolean>;
  seedAuthStateFromSnapshot: (snapshot: PersistedAuthSnapshot) => void;
  setAuthBootState: (value: AuthBootState) => void;
  setIsLoading: (value: boolean) => void;
  startSessionHydrationInBackground: (session: Session, event: string) => void;
}

interface SessionSubscriptionParams {
  clearAuthState: (options?: { keepLoading?: boolean; nextBootState?: AuthBootState }) => void;
  confirmPersistedSession: () => Promise<Session | null>;
  isDemoRef: MutableRefObject<boolean>;
  lastSeededSessionAtRef: MutableRefObject<number>;
  recoverAndHydrateSession: (session: Session) => Promise<void>;
  startSessionHydrationInBackground: (session: Session, event: string) => void;
  suppressSignedOutRef: MutableRefObject<boolean>;
}

export function useAuthBootstrapInit({
  applyDemoState,
  clearAuthState,
  clearDemoStorage,
  getPersistedAuthBootstrapSnapshot,
  seedAuthStateFromSnapshot,
  setAuthBootState,
  setIsLoading,
  startSessionHydrationInBackground,
}: BootstrapParams) {
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setAuthBootState("booting");
      let deferLoadingFlip = false;

      try {
        const authStorageVersion = await AsyncStorage.getItem(AUTH_STORAGE_VERSION_KEY);
        if (authStorageVersion !== AUTH_STORAGE_VERSION) {
          await hardSignOut("auth-storage-version-reset");
          await AsyncStorage.setItem(AUTH_STORAGE_VERSION_KEY, AUTH_STORAGE_VERSION);
        }

        let demoCleanupPromise: Promise<void> | null = null;
        if (!DEMO_MODE_ENABLED) {
          demoCleanupPromise = clearDemoStorage();
        } else {
          const savedDemoType = await AsyncStorage.getItem(DEMO_MODE_KEY);
          if (!cancelled && (savedDemoType === "student" || savedDemoType === "club")) {
            applyDemoState(savedDemoType);
            setIsLoading(false);
            return;
          }
        }

        const persistedSnapshotPromise = getPersistedAuthBootstrapSnapshot();
        const sessionPromise = getActiveOrPersistedSession();
        const racedSessionPromise = raceWithTimeout(sessionPromise, AUTH_BOOT_SESSION_TIMEOUT_MS);
        const [persistedSnapshot] = await Promise.all([
          persistedSnapshotPromise,
          demoCleanupPromise ?? Promise.resolve(),
        ]);
        const hasPersistedSnapshot = Boolean(persistedSnapshot);

        if (!cancelled && persistedSnapshot) {
          seedAuthStateFromSnapshot(persistedSnapshot);
          setIsLoading(false);
        }

        const raced = await racedSessionPromise;
        if (cancelled) return;

        if (raced.timedOut) {
          deferLoadingFlip = true;
          if (hasPersistedSnapshot) {
            setIsLoading(false);
          }

          sessionPromise
            .then((lateSession) => {
              if (cancelled) return;
              if (lateSession) {
                startSessionHydrationInBackground(lateSession, "INITIAL_SESSION");
              } else {
                clearAuthState({ keepLoading: true });
              }
              setIsLoading(false);
            })
            .catch((error) => {
              if (cancelled) return;
              logError(error, {
                captureInSentry: false,
                meta: {
                  operation: "auth-bootstrap-late-session",
                  scope: "auth-bootstrap",
                },
                name: "auth-bootstrap-non-blocking-error",
              });
              clearAuthState({ keepLoading: true });
              setIsLoading(false);
            });

          if (hasPersistedSnapshot) {
            return;
          }
        } else if (raced.value) {
          startSessionHydrationInBackground(raced.value, "INITIAL_SESSION");
        } else {
          clearAuthState({ keepLoading: true });
        }
      } catch (error) {
        logError(error, {
          captureInSentry: false,
          meta: {
            operation: "auth-bootstrap-init",
            scope: "auth-bootstrap",
          },
          name: "auth-bootstrap-non-blocking-error",
        });
        clearAuthState({ keepLoading: true });
      } finally {
        if (!cancelled && !deferLoadingFlip) {
          setIsLoading(false);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [
    applyDemoState,
    clearAuthState,
    clearDemoStorage,
    getPersistedAuthBootstrapSnapshot,
    seedAuthStateFromSnapshot,
    setAuthBootState,
    setIsLoading,
    startSessionHydrationInBackground,
  ]);
}

export function useAuthSessionSubscription({
  clearAuthState,
  confirmPersistedSession,
  isDemoRef,
  lastSeededSessionAtRef,
  recoverAndHydrateSession,
  startSessionHydrationInBackground,
  suppressSignedOutRef,
}: SessionSubscriptionParams) {
  useEffect(() => {
    let cancelled = false;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          if (event === "INITIAL_SESSION") {
            return;
          }
          if (isDemoRef.current) return;

          if (session) {
            await persistAuthSession(session);
            if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
              return;
            }
            if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
              startSessionHydrationInBackground(session, event);
              return;
            }

            try {
              await recoverAndHydrateSession(session);
            } catch (error) {
              debugWarn("AUTH", "session-recovery-failed-after-auth-event", {
                event,
                message: toErrorMessage(error),
              });
              await hardSignOut("auth-recovery-failed");
              clearAuthState();
            }
            return;
          }

          if (suppressSignedOutRef.current) return;
          const confirmedSession = await confirmPersistedSession();
          if (confirmedSession) {
            startSessionHydrationInBackground(
              confirmedSession,
              "session-confirmed-after-null-auth-event",
            );
            return;
          }
          if (event !== "SIGNED_OUT") {
            debugWarn("AUTH", "ignored-null-session-non-signout-auth-event", {
              event,
            });
            return;
          }
          if (Date.now() - lastSeededSessionAtRef.current < 15_000) {
            debugWarn("AUTH", "ignored-null-session-auth-event-after-login", {
              graceWindowMs: 15_000,
            });
            return;
          }
          await hardSignOut("sign-out").catch((error) => {
            logError(error, {
              captureInSentry: false,
              meta: {
                event,
                operation: "hard-sign-out",
                scope: "auth-session-subscription",
              },
              name: "auth-session-non-blocking-error",
            });
          });
          await persistAuthSession(null);
          clearAuthState();
        })();
      }, 0);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [
    clearAuthState,
    confirmPersistedSession,
    isDemoRef,
    lastSeededSessionAtRef,
    recoverAndHydrateSession,
    startSessionHydrationInBackground,
    suppressSignedOutRef,
  ]);
}
