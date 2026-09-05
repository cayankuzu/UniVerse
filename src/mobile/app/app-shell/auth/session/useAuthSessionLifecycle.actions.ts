import { AuthAPI } from "../../../data/auth";
import {
  bestEffortUnregisterStoredPushToken,
  type PushUnregisterCleanupResult,
  type PushUnregisterCleanupReason,
} from "../../../data/notifications";
import { debugWarn } from "../../../platform/logging/logger";
import { clearPersistedNavigationState } from "../../navigation/navigationStatePersistence";
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

const PUSH_LOGOUT_UNREGISTER_TIMEOUT_MS = 3_500;

function retainedPushCleanupResult(
  reason: PushUnregisterCleanupReason,
  error?: unknown,
): PushUnregisterCleanupResult {
  return { error, reason, status: "retained" };
}

function normalizePushCleanupResult(value: unknown): PushUnregisterCleanupResult {
  if (value && typeof value === "object" && "status" in value) {
    const result = value as PushUnregisterCleanupResult;
    if (
      result.status === "cleared" ||
      result.status === "missing" ||
      result.status === "superseded" ||
      result.status === "retained"
    ) {
      return result;
    }
  }
  return retainedPushCleanupResult("unregister-unconfirmed");
}

async function unregisterPushTokenBeforeLogout(): Promise<PushUnregisterCleanupResult> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutError = new Error("Push token unregister timed out during logout.");
  const unregisterPromise = Promise.resolve(
    bestEffortUnregisterStoredPushToken({
      signal: controller?.signal,
      timeoutMs: PUSH_LOGOUT_UNREGISTER_TIMEOUT_MS,
    }),
  ).then(normalizePushCleanupResult);
  const timeoutPromise = new Promise<PushUnregisterCleanupResult>((resolve) => {
    timeout = setTimeout(() => {
      controller?.abort();
      resolve(retainedPushCleanupResult("unregister-failed", timeoutError));
    }, PUSH_LOGOUT_UNREGISTER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([unregisterPromise, timeoutPromise]);
  } catch (error) {
    return retainedPushCleanupResult("unregister-failed", error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

interface CreateDeleteAccountHandlerParams {
  clearAuthState: (opts?: { keepLoading?: boolean }) => void;
  clearDemoStorage: () => Promise<void>;
  isDemoRef: { current: boolean };
  logout: () => Promise<void>;
  signOut: (options: { clearPushRegistration: true }) => Promise<void>;
}

export function createLogoutHandler(params: CreateLogoutHandlerParams) {
  return async () => {
    const wasDemo = params.isDemoRef.current;
    params.isDemoRef.current = false;
    params.suppressSignedOutRef.current = true;
    let signOutError: unknown;
    if (!wasDemo) {
      const pushCleanup = await unregisterPushTokenBeforeLogout();
      if (pushCleanup.status === "retained") {
        reportRecoverableAuthSessionError(
          pushCleanup.error || new Error("Push token cleanup was not confirmed during logout."),
          "auth-logout-push-unregister-retained",
          "Push token cleanup will be retried after the next authenticated registration.",
          "logout-push-unregister",
        );
        debugWarn("AUTH", "logout-push-unregister-retained", {
          reason: pushCleanup.reason,
        });
      }
      try {
        await params.signOut();
      } catch (error) {
        signOutError = error;
      }
    }

    const cleanupResults = await Promise.allSettled([
      Promise.resolve().then(() => params.clearDemoStorage()),
      Promise.resolve().then(() => clearPersistedNavigationState()),
    ]);
    params.clearAuthState();

    if (signOutError) throw signOutError;
    const failedCleanup = cleanupResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedCleanup) throw failedCleanup.reason;
  };
}

export function createDeleteAccountHandler(params: CreateDeleteAccountHandlerParams) {
  return async () => {
    if (params.isDemoRef.current) {
      await params.logout();
      return;
    }

    try {
      const result = await AuthAPI.deleteAccount();
      if (result?.success !== true) {
        throw new Error("Delete account response was not confirmed.");
      }
    } catch (error) {
      throw toRecoverableAuthSessionError(
        error,
        "auth-delete-account-failed",
        "Hesap silinemedi.",
        "delete-account",
      );
    }

    try {
      await params.signOut({ clearPushRegistration: true });
    } catch (cleanupError) {
      reportRecoverableAuthSessionError(
        cleanupError,
        "auth-delete-account-cleanup-signout-failed",
        "Delete account sign out cleanup failed.",
        "delete-account-cleanup",
      );
    }

    const cleanupResults = await Promise.allSettled([
      Promise.resolve().then(() => params.clearDemoStorage()),
      Promise.resolve().then(() => clearPersistedNavigationState()),
    ]);
    params.clearAuthState();
    cleanupResults.forEach((result, index) => {
      if (result.status !== "rejected") return;
      reportRecoverableAuthSessionError(
        result.reason,
        index === 0
          ? "auth-delete-account-demo-storage-cleanup-failed"
          : "auth-delete-account-navigation-cleanup-failed",
        "Delete account local cleanup failed after server confirmation.",
        "delete-account-cleanup",
      );
    });
  };
}
