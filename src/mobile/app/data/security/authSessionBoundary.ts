import { clearSupabaseAuthStorage, supabase } from "../../platform/supabase";
import { logAuthSessionError } from "../../platform/security/authSessionErrors";
import {
  clearSensitiveClientState,
  type SensitiveClientStateClearReason,
} from "./clearSensitiveClientState";

export type { SensitiveClientStateClearReason } from "./clearSensitiveClientState";

export async function hardSignOut(reason: SensitiveClientStateClearReason = "sign-out") {
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

  await clearSupabaseAuthStorage();
  await clearSensitiveClientState({ reason });
}
