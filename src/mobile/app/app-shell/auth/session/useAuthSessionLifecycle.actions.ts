import { AuthAPI } from "../../../data/auth";
import { bestEffortUnregisterStoredPushToken } from "../../../data/notifications";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import { clearPersistedNavigationState } from "../../navigation/navigationStatePersistence";
import { toErrorMessage } from "./authContext.shared";
import {
  reportRecoverableAuthSessionError,
  toRecoverableAuthSessionError,
} from "./useAuthSessionLifecycle.errors";

interface CreateLogoutHandlerParams {
  clearAuthState: (opts?: { keepLoading?: boolean }) => void;
  clearDemoStorage: () => Promise<void>;
  isDemoRef: { current: boolean };
  signOut: () => Promise<void>;
  suppressSignedOutRef: { current: boolean };
}

interface CreateDeleteAccountHandlerParams {
  clearAuthState: (opts?: { keepLoading?: boolean }) => void;
  clearDemoStorage: () => Promise<void>;
  isDemoRef: { current: boolean };
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function createLogoutHandler(params: CreateLogoutHandlerParams) {
  return async () => {
    const wasDemo = params.isDemoRef.current;
    params.isDemoRef.current = false;
    params.suppressSignedOutRef.current = false;
    const clearDemoStoragePromise = params.clearDemoStorage();
    if (!wasDemo) {
      void bestEffortUnregisterStoredPushToken().catch((error) => {
        reportRecoverableAuthSessionError(
          error,
          "auth-logout-push-unregister-failed",
          "Push token cleanup failed during logout.",
          "logout-push-unregister",
        );
      });
      await params.signOut();
    }
    await clearDemoStoragePromise;
    await clearPersistedNavigationState();
    params.clearAuthState();
  };
}

export function createDeleteAccountHandler(params: CreateDeleteAccountHandlerParams) {
  return async () => {
    if (params.isDemoRef.current) {
      await params.logout();
      return;
    }

    try {
      await AuthAPI.deleteAccount();
    } catch (error) {
      const msg = toErrorMessage(error).toLowerCase();
      const isAuthRelated =
        msg.includes("invalid jwt") ||
        msg.includes("unauthorized") ||
        msg.includes("oturum geçersiz") ||
        msg.includes("tekrar giriş");
      if (!isAuthRelated) {
        throw toRecoverableAuthSessionError(
          error,
          "auth-delete-account-failed",
          "Hesap silinemedi.",
          "delete-account",
        );
      }
      const chk = await supabase.auth.getUser().catch((userCheckError) => {
        reportRecoverableAuthSessionError(
          userCheckError,
          "auth-delete-account-user-check-failed",
          "Delete account user verification failed.",
          "delete-account-user-check",
        );
        return { data: { user: null }, error: null };
      });
      if (chk.data?.user) {
        debugWarn("AUTH", "delete-account-server-failed-force-signout", { message: msg });
      }
    }

    try {
      await params.signOut();
    } catch (cleanupError) {
      reportRecoverableAuthSessionError(
        cleanupError,
        "auth-delete-account-cleanup-signout-failed",
        "Delete account sign out cleanup failed.",
        "delete-account-cleanup",
      );
    }

    await params.clearDemoStorage();
    await clearPersistedNavigationState();
    params.clearAuthState();
  };
}
