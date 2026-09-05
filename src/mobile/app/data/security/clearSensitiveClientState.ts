import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_PROJECT_ID } from "../../platform/config/supabasePublic";
import { clearPendingRegistrationDraft } from "../auth/pendingRegistrationDraft";
import { queryClient } from "../query/queryClient";
import {
  clearLocalAlbumShadowStorage,
  clearLocalEventShadowStorage,
} from "../content/localShadowStorage";
import { clearPersistedWarmupPreferences } from "../projections/warmupPreferences";
import { clearTrackedSecureKeys } from "../../platform/storage/authStorage";
import { clearPersistedQueryCache, QUERY_CACHE_PERSIST_KEY } from "../query/persist";
import {
  clearPersistedMediaUriCache,
  MEDIA_URI_CACHE_PERSIST_KEY,
} from "../../shared/media/mediaUri";
import { resetOptimisticOutboxMetaStore } from "../queues/optimisticOutboxMeta";
import { resetSyncOrchestratorStore } from "../projections/sync/syncOrchestrator";
import { resetUiViewStateStore } from "../projections/uiViewState";
import { clearMutationActionQueueStorage } from "../queues/mutationActionQueue";
import { clearUploadQueueStorage } from "../queues/uploadQueue";
import { NotificationPushAPI } from "../notifications/notifications.push";

const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token`;
const AUTH_PKCE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token-code-verifier`;

const SENSITIVE_PREFIXES = ["pending:follow:", "shadow:follow-status:v1:"] as const;

const SENSITIVE_EXACT_KEYS = [
  QUERY_CACHE_PERSIST_KEY,
  MEDIA_URI_CACHE_PERSIST_KEY,
  "album-local-shadow:v2",
  "event-local-shadow:v2",
  "mutation-action-queue:v1",
  "upload-queue:v1",
] as const;

export type SensitiveClientStateClearReason =
  | "auth-recovery-failed"
  | "auth-storage-version-reset"
  | "delete-account"
  | "logout"
  | "reset-password-boundary"
  | "sign-out"
  | "unknown";

function isDynamicSupabaseAuthKey(key: string) {
  const lowered = key.toLowerCase();
  return (
    key === AUTH_STORAGE_KEY ||
    key === AUTH_PKCE_KEY ||
    (lowered.startsWith("sb-") && lowered.includes("auth-token")) ||
    lowered.includes(`${SUPABASE_PROJECT_ID.toLowerCase()}-auth-token`) ||
    lowered.includes("supabase.auth.token")
  );
}

function isSensitiveAsyncStorageKey(key: string) {
  return (
    SENSITIVE_EXACT_KEYS.includes(key as (typeof SENSITIVE_EXACT_KEYS)[number]) ||
    SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
    isDynamicSupabaseAuthKey(key)
  );
}

export async function clearSensitiveClientState(options?: {
  clearPushRegistration?: boolean;
  reason?: SensitiveClientStateClearReason;
}) {
  queryClient.clear();
  resetSyncOrchestratorStore();
  resetUiViewStateStore();
  resetOptimisticOutboxMetaStore();

  const keys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
  const removableKeys = Array.from(new Set(keys.filter(isSensitiveAsyncStorageKey)));

  const cleanupResults = await Promise.allSettled([
    clearTrackedSecureKeys(),
    clearPersistedQueryCache(),
    clearPersistedMediaUriCache(),
    clearPersistedWarmupPreferences(),
    clearMutationActionQueueStorage(),
    ...(options?.clearPushRegistration ? [NotificationPushAPI.clearStoredRegistration()] : []),
    clearPendingRegistrationDraft(),
    clearUploadQueueStorage(),
    clearLocalAlbumShadowStorage(),
    clearLocalEventShadowStorage(),
  ]);

  if (removableKeys.length > 0) {
    cleanupResults.push(
      await AsyncStorage.multiRemove(removableKeys).then(
        () => ({ status: "fulfilled", value: undefined }) as PromiseFulfilledResult<void>,
        (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult,
      ),
    );
  }

  const failedCleanup = cleanupResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failedCleanup) {
    throw failedCleanup.reason;
  }
}
