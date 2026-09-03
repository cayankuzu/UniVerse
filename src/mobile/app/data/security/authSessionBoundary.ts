import { clearSupabaseAuthStorage, supabase } from "../../platform/supabase";
import { logAuthSessionError } from "../../platform/security/authSessionErrors";
import {
  clearSensitiveClientState,
  type SensitiveClientStateClearReason,
} from "./clearSensitiveClientState";

export type { SensitiveClientStateClearReason } from "./clearSensitiveClientState";

export async function hardSignOut(
  reason: SensitiveClientStateClearReason = "sign-out",
  options?: { clearPushRegistration?: boolean },
) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    logAuthSessionError(error, {
      code: "auth-hard-signout-local-failed",
      fallbackMessage: "Local sign out failed.",
      meta: { reason },
      operation: "hard-sign-out",
      recoverable: true,
      scope: "supabase-auth",
    });
  }

  let cleanupError: unknown;
  try {
    await clearSupabaseAuthStorage();
  } catch (error) {
    cleanupError = error;
    logAuthSessionError(error, {
      code: "auth-hard-signout-storage-clear-failed",
      fallbackMessage: "Local auth storage cleanup failed.",
      meta: { reason },
      operation: "hard-sign-out",
      recoverable: true,
      scope: "auth-storage",
    });
  }

  try {
    await clearSensitiveClientState({
      ...(options?.clearPushRegistration ? { clearPushRegistration: true } : {}),
      reason,
    });
  } catch (error) {
    cleanupError ??= error;
    logAuthSessionError(error, {
      code: "auth-hard-signout-sensitive-clear-failed",
      fallbackMessage: "Sensitive client state cleanup failed.",
      meta: { reason },
      operation: "hard-sign-out",
      recoverable: true,
      scope: "client-state",
    });
  }

  if (cleanupError) throw cleanupError;
}
