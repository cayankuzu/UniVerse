import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { AppPushNotificationsBridge } from "../bridges/AppPushNotificationsBridge";
import { ProjectionRealtimeBridge } from "../bridges/ProjectionRealtimeBridge";
import { AppMutationQueueProcessor } from "../queues/AppMutationQueueProcessor";
import { AppUploadQueueProcessor } from "../queues/AppUploadQueueProcessor";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";
import { AppDataWarmup } from "./AppDataWarmup";
import { useAppStartupState } from "./AppStartupState";

type DeferredServiceState = {
  mutationQueue: boolean;
  pushBridge: boolean;
  realtime: boolean;
  uploadQueue: boolean;
};

type DeferredServiceKey = keyof DeferredServiceState;
type DeferredServicePlanEntry = {
  key: DeferredServiceKey;
  waitMs: number;
};

const INITIAL_DEFERRED_SERVICE_STATE: DeferredServiceState = {
  mutationQueue: false,
  pushBridge: false,
  realtime: false,
  uploadQueue: false,
};

const AUTHENTICATED_DEFERRED_SERVICE_PLAN: readonly DeferredServicePlanEntry[] = [
  { key: "uploadQueue", waitMs: 100 },
  { key: "mutationQueue", waitMs: 80 },
  { key: "realtime", waitMs: 160 },
  { key: "pushBridge", waitMs: 480 },
];

function activateDeferredService(
  state: DeferredServiceState,
  key: DeferredServiceKey,
): DeferredServiceState {
  if (state[key]) return state;
  return {
    ...state,
    [key]: true,
  };
}

export function DeferredAppServices() {
  const { queryCacheReady } = useAppStartupState();
  const { authBootState, isDemoMode, isLoggedIn, userData } = useAuth();
  const [serviceState, setServiceState] = useState<DeferredServiceState>(
    INITIAL_DEFERRED_SERVICE_STATE,
  );
  const viewerId = String(userData.id || "").trim();
  const isHydratedSession = authBootState === "signed_in_hydrated";
  const enableAuthenticatedServices = queryCacheReady && isHydratedSession;
  const enableWarmup =
    queryCacheReady && isLoggedIn && isHydratedSession && !isDemoMode && Boolean(viewerId);
  const enablePushBridge = isLoggedIn && isHydratedSession && !isDemoMode && Boolean(viewerId);

  useEffect(() => {
    setServiceState(INITIAL_DEFERRED_SERVICE_STATE);
    if (!enableAuthenticatedServices) return;

    let cancelled = false;
    let scheduledTask: { cancel: () => void } | null = null;
    const servicePlan = AUTHENTICATED_DEFERRED_SERVICE_PLAN.filter((entry) => {
      if (entry.key === "pushBridge") {
        return enablePushBridge;
      }
      return true;
    });

    const scheduleNextService = (index: number) => {
      const entry = servicePlan[index];
      if (cancelled || !entry) return;
      scheduledTask = scheduleAfterInteractions(() => {
        if (cancelled) return;
        setServiceState((current) => activateDeferredService(current, entry.key));
        scheduleNextService(index + 1);
      }, entry.waitMs);
    };

    scheduleNextService(0);

    return () => {
      cancelled = true;
      scheduledTask?.cancel();
    };
  }, [enableAuthenticatedServices, enablePushBridge, viewerId]);

  return (
    <>
      {enableWarmup ? <AppDataWarmup /> : null}
      {enablePushBridge && serviceState.pushBridge ? <AppPushNotificationsBridge /> : null}
      {serviceState.mutationQueue ? <AppMutationQueueProcessor /> : null}
      {serviceState.uploadQueue ? <AppUploadQueueProcessor /> : null}
      {serviceState.realtime ? <ProjectionRealtimeBridge /> : null}
    </>
  );
}
