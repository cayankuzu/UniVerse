import type { Session } from "@supabase/supabase-js";
import { useCallback, useRef } from "react";
import { debugWarn } from "../../../platform/logging/logger";
import { logError } from "../../../platform/observability";
import {
  SESSION_HYDRATE_TIMEOUT_MS,
  shouldRetryHydrationWithRefresh,
  toErrorMessage,
  withTimeout,
} from "./authContext.shared";
import {
  buildSessionHydrationKey,
  confirmPersistedSession,
  refreshSessionWithTimeout,
} from "./useAuthSessionLifecycle.helpers";
import type { UseAuthSessionLifecycleParams } from "./useAuthSessionLifecycle.types";

type UseAuthSessionHydrationParams = Pick<
  UseAuthSessionLifecycleParams,
  | "activeHydrationKeyRef"
  | "activeHydrationPromiseRef"
  | "fetchProfile"
  | "hydratedSessionKey"
  | "isDemoRef"
  | "refreshBlocked"
  | "suppressSignedOutRef"
> & {
  seedAuthStateFromSession: (session: Session) => void;
};

export function useAuthSessionHydration({
  activeHydrationKeyRef,
  activeHydrationPromiseRef,
  fetchProfile,
  hydratedSessionKey,
  isDemoRef,
  refreshBlocked,
  seedAuthStateFromSession,
  suppressSignedOutRef,
}: UseAuthSessionHydrationParams) {
  const profileHydrationKeyRef = useRef("");
  const profileHydrationPromiseRef = useRef<Promise<void> | null>(null);

  const syncHydratedProfile = useCallback(
    async (session: Session, options?: { timeoutCode?: string; timeoutMs?: number }) => {
      const nextSessionKey = buildSessionHydrationKey(session);
      if (hydratedSessionKey.current === nextSessionKey) {
        return;
      }
      if (profileHydrationPromiseRef.current && profileHydrationKeyRef.current === nextSessionKey) {
        return profileHydrationPromiseRef.current;
      }

      const run = (async () => {
        await (options?.timeoutMs && options.timeoutMs > 0
          ? withTimeout(fetchProfile(), options.timeoutMs, options.timeoutCode || "hydrate-timeout")
          : fetchProfile());
        hydratedSessionKey.current = nextSessionKey;
        void refreshBlocked().catch((error) => {
          logError(error, {
            captureInSentry: false,
            meta: {
              operation: "refresh-blocked-users",
              scope: "auth-session-hydrate",
            },
            name: "auth-session-non-blocking-error",
          });
        });
      })();

      profileHydrationKeyRef.current = nextSessionKey;
      profileHydrationPromiseRef.current = run;
      try {
        await run;
      } finally {
        if (profileHydrationPromiseRef.current === run) {
          profileHydrationPromiseRef.current = null;
          profileHydrationKeyRef.current = "";
        }
      }
    },
    [fetchProfile, hydratedSessionKey, refreshBlocked],
  );

  const continueHydrationInBackground = useCallback(
    (session: Session, source: string) => {
      const nextSessionKey = buildSessionHydrationKey(session);
      if (hydratedSessionKey.current === nextSessionKey) {
        return;
      }
      if (profileHydrationPromiseRef.current && profileHydrationKeyRef.current === nextSessionKey) {
        return;
      }
      setTimeout(() => {
        void syncHydratedProfile(session, {
          timeoutCode: "background-hydrate-timeout",
          timeoutMs: SESSION_HYDRATE_TIMEOUT_MS * 2,
        }).catch((error) => {
          debugWarn("AUTH", "session-profile-hydration-failed", {
            message: toErrorMessage(error),
            source,
          });
        });
      }, 0);
    },
    [hydratedSessionKey, syncHydratedProfile],
  );

  const hydrateFromSessionWithTimeout = useCallback(
    async (session: Session) => {
      if (isDemoRef.current) return;
      const nextSessionKey = buildSessionHydrationKey(session);
      if (hydratedSessionKey.current === nextSessionKey) {
        return;
      }
      seedAuthStateFromSession(session);
      try {
        await syncHydratedProfile(session, {
          timeoutCode: "hydrate-timeout",
          timeoutMs: SESSION_HYDRATE_TIMEOUT_MS,
        });
      } catch (error) {
        if (hydratedSessionKey.current === nextSessionKey) {
          hydratedSessionKey.current = "";
        }
        throw error;
      }
    },
    [hydratedSessionKey, isDemoRef, seedAuthStateFromSession, syncHydratedProfile],
  );

  const releaseSignedOutSuppression = useCallback(() => {
    const startedAt = Date.now();
    const poll = async () => {
      const confirmedSession = await confirmPersistedSession();
      if (confirmedSession || Date.now() - startedAt >= 15_000) {
        suppressSignedOutRef.current = false;
        return;
      }
      setTimeout(() => {
        void poll();
      }, 250);
    };
    void poll();
  }, [suppressSignedOutRef]);

  const recoverAndHydrateSession = useCallback(
    async (session: Session) => {
      const sessionKey = buildSessionHydrationKey(session);
      if (activeHydrationPromiseRef.current && activeHydrationKeyRef.current === sessionKey) {
        return activeHydrationPromiseRef.current;
      }

      const run = (async () => {
        try {
          await hydrateFromSessionWithTimeout(session);
          return;
        } catch (primaryError) {
          if (toErrorMessage(primaryError) === "hydrate-timeout") {
            continueHydrationInBackground(session, "hydrate-timeout");
            return;
          }
          if (!shouldRetryHydrationWithRefresh(primaryError)) {
            throw primaryError;
          }
          const { data, error } = await refreshSessionWithTimeout();
          if (error || !data.session) {
            throw error || new Error("session-refresh-failed");
          }
          try {
            await hydrateFromSessionWithTimeout(data.session);
          } catch (refreshError) {
            if (toErrorMessage(refreshError) === "hydrate-timeout") {
              continueHydrationInBackground(data.session, "hydrate-timeout-after-refresh");
              return;
            }
            throw refreshError;
          }
        }
      })();

      activeHydrationKeyRef.current = sessionKey;
      activeHydrationPromiseRef.current = run;
      try {
        await run;
      } finally {
        if (activeHydrationPromiseRef.current === run) {
          activeHydrationPromiseRef.current = null;
          activeHydrationKeyRef.current = "";
        }
      }
    },
    [
      activeHydrationKeyRef,
      activeHydrationPromiseRef,
      continueHydrationInBackground,
      hydrateFromSessionWithTimeout,
    ],
  );

  const startSessionHydrationInBackground = useCallback(
    (session: Session, event: string) => {
      seedAuthStateFromSession(session);
      setTimeout(() => {
        void recoverAndHydrateSession(session).catch((error) => {
          debugWarn("AUTH", "session-hydration-failed-after-auth-event", {
            event,
            message: toErrorMessage(error),
          });
        });
      }, 0);
    },
    [recoverAndHydrateSession, seedAuthStateFromSession],
  );

  return {
    recoverAndHydrateSession,
    releaseSignedOutSuppression,
    startSessionHydrationInBackground,
  };
}
