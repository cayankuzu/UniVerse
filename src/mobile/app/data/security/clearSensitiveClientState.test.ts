import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_PROJECT_ID } from "../../platform/config/supabasePublic";
import { queryClient } from "../query/queryClient";
import { useOptimisticOutboxMetaStore } from "../queues/optimisticOutboxMeta";
import { useSyncOrchestratorStore } from "../projections/sync/syncOrchestrator";
import { useUiViewStateStore } from "../projections/uiViewState";
import { QUERY_CACHE_PERSIST_KEY } from "../query/persist";
import { MEDIA_URI_CACHE_PERSIST_KEY } from "../../shared/media/mediaUri";
import { NotificationPushAPI } from "../notifications/notifications.push";
import { clearSensitiveClientState } from "./clearSensitiveClientState";

describe("clearSensitiveClientState", () => {
  beforeEach(async () => {
    jest.spyOn(NotificationPushAPI, "clearStoredRegistration").mockResolvedValue(undefined);
    await AsyncStorage.clear();
    queryClient.clear();
    useSyncOrchestratorStore.getState().reset();
    useUiViewStateStore.getState().reset();
    useOptimisticOutboxMetaStore.getState().reset();
  });

  it("purges sensitive caches while preserving non-auth UI preferences", async () => {
    await AsyncStorage.multiSet([
      [QUERY_CACHE_PERSIST_KEY, '{"queries":[]}'],
      [
        MEDIA_URI_CACHE_PERSIST_KEY,
        '[{"cacheKey":"events/1.jpg","url":"https://cdn.example.com/events/1.jpg","expiresAt":9999999999999}]',
      ],
      [`sb-${SUPABASE_PROJECT_ID}-auth-token`, "auth-token"],
      ["shadow:follow-status:v1:user:username:test", '{"status":"following"}'],
      ["pending:follow:viewer:test", "1"],
      ["warmup:last-home-scope:v1:viewer-1", '{"scope":"following:events:clubs:oldest"}'],
      ["warmup:last-profile-tab:v1:viewer-1", "events"],
      ["warmup:last-search-scope:v1:viewer-1", '{"kind":"events","scope":"events:test"}'],
      ["mutation-action-queue:v1", "[]"],
      ["upload-queue:v1", "[]"],
      ["album-local-shadow:v2", "{}"],
      ["event-local-shadow:v2", "{}"],
      ["UNiETAS_onboarding_student", "completed"],
    ]);

    queryClient.setQueryData(["viewer", "profile"], { id: "viewer-1" });
    useSyncOrchestratorStore.getState().registerProjection("screen:home", {
      entity: "home-feed",
      freshnessSlaMs: 1000,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync: async () => null,
    });
    useUiViewStateStore.getState().markContentRendered("screen:home");
    useOptimisticOutboxMetaStore.getState().begin({
      action: "follow",
      entity: "profile",
      id: "mutation-1",
    });

    await clearSensitiveClientState({ reason: "logout" });

    expect(await AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(MEDIA_URI_CACHE_PERSIST_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(`sb-${SUPABASE_PROJECT_ID}-auth-token`)).toBeNull();
    expect(await AsyncStorage.getItem("shadow:follow-status:v1:user:username:test")).toBeNull();
    expect(await AsyncStorage.getItem("pending:follow:viewer:test")).toBeNull();
    expect(await AsyncStorage.getItem("warmup:last-home-scope:v1:viewer-1")).toBeNull();
    expect(await AsyncStorage.getItem("warmup:last-profile-tab:v1:viewer-1")).toBeNull();
    expect(await AsyncStorage.getItem("warmup:last-search-scope:v1:viewer-1")).toBeNull();
    expect(await AsyncStorage.getItem("mutation-action-queue:v1")).toBeNull();
    expect(await AsyncStorage.getItem("UNiETAS_onboarding_student")).toBe("completed");
    expect(queryClient.getQueryData(["viewer", "profile"])).toBeUndefined();
    expect(useSyncOrchestratorStore.getState().projections).toEqual({});
    expect(useUiViewStateStore.getState().screens).toEqual({});
    expect(useOptimisticOutboxMetaStore.getState().entries).toEqual({});
    expect(NotificationPushAPI.clearStoredRegistration).not.toHaveBeenCalled();
  });

  it("clears the stored push registration only after confirmed account deletion", async () => {
    await clearSensitiveClientState({
      clearPushRegistration: true,
      reason: "delete-account",
    });

    expect(NotificationPushAPI.clearStoredRegistration).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
