import type { Session } from "@supabase/supabase-js";
import { AuthAPI } from "../../../data/auth";
import { isEmailConfirmationError } from "../../../platform/security/errors";
import { supabase } from "../../../platform/supabase";
import { DEMO_MODE_ENABLED } from "../../../platform/config/runtime";
import { hardSignOut } from "../../../data/security/authSessionBoundary";
import { queryClient } from "../../../data/query/queryClient";
import { buildDemoAuthState, DEMO_CREDENTIALS } from "./authFixtureSeed";
import {
  LOGIN_PROFILE_SYNC_WAIT_MS,
  LOGIN_STEP_TIMEOUT_MS,
  toErrorMessage,
  withTimeout,
} from "./authContext.shared";
import {
  persistDemoAuthStateBestEffort,
  waitForPersistedSession,
} from "./useAuthSessionLifecycle.helpers";
import {
  reportRecoverableAuthSessionError,
  toRecoverableAuthSessionError,
} from "./useAuthSessionLifecycle.errors";

const LOGIN_SESSION_RECOVERY_WAIT_MS = 2500;
type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

interface CreateLoginHandlerParams {
  applyDemoState: (type: "student" | "club") => void;
  clearAuthState: (opts?: { keepLoading?: boolean }) => void;
  recoverAndHydrateSession: (session: Session) => Promise<void>;
  releaseSignedOutSuppression: () => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  suppressSignedOutRef: React.MutableRefObject<boolean>;
}

export function createLoginHandler(params: CreateLoginHandlerParams) {
  return async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (DEMO_MODE_ENABLED) {
      const demo = DEMO_CREDENTIALS.find(
        (item) => item.email === normalizedEmail && item.password === password,
      );
      if (demo) {
        queryClient.clear();
        params.applyDemoState(demo.type);
        persistDemoAuthStateBestEffort(
          demo.type,
          buildDemoAuthState(demo.type).userData,
          "demo-login",
        );
        params.setIsLoading(false);
        return;
      }
    }

    params.suppressSignedOutRef.current = true;
    let loginCompleted = false;
    let sessionEstablished = false;
    try {
      const signInOnce = async () =>
        supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      const waitForLoginProfileSync = async (session: Session) => {
        await withTimeout(
          params.recoverAndHydrateSession(session),
          LOGIN_PROFILE_SYNC_WAIT_MS,
          "login-profile-sync-wait-timeout",
        ).catch((error) => {
          if (toErrorMessage(error) === "login-profile-sync-wait-timeout") {
            return;
          }
          throw error;
        });
      };
      const signInWithTimeoutRecovery = async (timeoutCode: string): Promise<SignInResult> => {
        try {
          return await withTimeout(signInOnce(), LOGIN_STEP_TIMEOUT_MS, timeoutCode);
        } catch (error) {
          if (toErrorMessage(error) !== timeoutCode) {
            throw error;
          }
          const recoveredSession = await waitForPersistedSession(LOGIN_SESSION_RECOVERY_WAIT_MS);
          if (!recoveredSession) {
            throw error;
          }
          return {
            data: {
              session: recoveredSession,
              user: recoveredSession.user,
            },
            error: null,
          } as SignInResult;
        }
      };

      let { data, error } = await signInWithTimeoutRecovery("login-signin-timeout");
      if (error) {
        const message = String(error.message || "").toLowerCase();
        const retryable =
          message.includes("invalid jwt") ||
          message.includes("refresh token") ||
          message.includes("invalid refresh token");
        if (retryable) {
          try {
            await withTimeout(
              hardSignOut("sign-out"),
              LOGIN_STEP_TIMEOUT_MS,
              "login-retry-presignout-timeout",
            );
          } catch (cleanupError) {
            reportRecoverableAuthSessionError(
              cleanupError,
              "auth-login-retry-presignout-failed",
              "Pre-login sign out failed.",
              "login-retry-presignout",
            );
          }
          const retry = await signInWithTimeoutRecovery("login-retry-signin-timeout");
          data = retry.data;
          error = retry.error;
        }
      }
      if (error && isEmailConfirmationError(error)) {
        const bypassed = await AuthAPI.confirmEmailForTesting(normalizedEmail).catch(
          (confirmError) => {
            reportRecoverableAuthSessionError(
              confirmError,
              "auth-login-email-confirm-bypass-failed",
              "Email confirmation bypass failed.",
              "login-email-confirm-bypass",
            );
            return false;
          },
        );
        if (bypassed) {
          const retry = await signInWithTimeoutRecovery("login-confirm-bypass-signin-timeout");
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error("Oturum oluşturulamadı. Lütfen tekrar deneyin.");
      }

      sessionEstablished = true;
      await waitForLoginProfileSync(data.session);
      loginCompleted = true;
    } catch (error) {
      if (sessionEstablished) {
        await Promise.resolve(hardSignOut("sign-out")).catch((cleanupError) => {
          reportRecoverableAuthSessionError(
            cleanupError,
            "auth-login-cleanup-signout-failed",
            "Post-login cleanup sign out failed.",
            "login-cleanup-signout",
          );
        });
        params.clearAuthState();
      }
      const message = toErrorMessage(error).toLowerCase();
      if (message.includes("timeout")) {
        throw toRecoverableAuthSessionError(
          new Error(
            "Giriş isteği zaman aşımına uğradı. İnternet bağlantını kontrol edip tekrar dene.",
          ),
          "auth-login-timeout",
          "Giriş isteği zaman aşımına uğradı.",
          "login",
        );
      }
      throw toRecoverableAuthSessionError(
        error,
        "auth-login-failed",
        "Giriş başarısız oldu.",
        "login",
      );
    } finally {
      if (loginCompleted) {
        params.releaseSignedOutSuppression();
      } else {
        params.suppressSignedOutRef.current = false;
      }
    }
  };
}
