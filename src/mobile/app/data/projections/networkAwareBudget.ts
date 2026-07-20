/**
 * Network-aware budget for warmup and prefetch throttling.
 *
 * Provides a lightweight signal about connectivity quality so warmup/prefetch
 * can reduce or skip low-priority work on poor connections.
 */
import { AppState, NativeModules, type AppStateStatus } from "react-native";
import type { NetInfoState } from "@react-native-community/netinfo";
import { debugWarn } from "../../platform/logging/logger";

export type NetworkQuality = "good" | "degraded" | "offline" | "unknown";

export interface NetworkBudget {
  allowIdlePrefetch: boolean;
  allowImagePrefetch: boolean;
  allowIntentPrefetch: boolean;
  allowNextPagePrefetch: boolean;
  quality: NetworkQuality;
}

// Unknown must be conservative: assuming a fast network during native startup
// can launch image/page prefetches before NetInfo has produced its first state.
let currentQuality: NetworkQuality = "unknown";
let listenerAttached = false;
const listeners = new Set<(quality: NetworkQuality) => void>();

function setNetworkQuality(quality: NetworkQuality) {
  if (currentQuality === quality) return;
  currentQuality = quality;
  listeners.forEach((listener) => listener(currentQuality));
}

function isExpensiveConnection(state: NetInfoState) {
  const details = state.details;
  if (!details || typeof details !== "object") return false;
  return Boolean("isConnectionExpensive" in details && details.isConnectionExpensive);
}

async function tryAttachNetInfoListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  try {
    if (!NativeModules.RNCNetInfo) {
      return;
    }
    const NetInfo = await import("@react-native-community/netinfo").then(
      (module) => module.default,
    );

    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected === false || state.isInternetReachable === false) {
        setNetworkQuality("offline");
        return;
      }

      const cellular = state.type === "cellular" ? state.details?.cellularGeneration : null;
      if (
        isExpensiveConnection(state) ||
        (state.type === "cellular" && (cellular === "2g" || cellular === "3g"))
      ) {
        setNetworkQuality("degraded");
        return;
      }

      setNetworkQuality("good");
    });
  } catch (error) {
    debugWarn("PROJECTIONS/NETWORK", "netinfo-listener-attach-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "netinfo-listener-attach-failed",
      ),
    });
    setNetworkQuality("unknown");
  }
}

export function initNetworkBudgetListener() {
  void tryAttachNetInfoListener();
}

export function getNetworkQuality(): NetworkQuality {
  return currentQuality;
}

export function subscribeNetworkQuality(listener: (quality: NetworkQuality) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveNetworkBudget(appState?: AppStateStatus): NetworkBudget {
  const effectiveAppState = appState ?? AppState.currentState;

  if (effectiveAppState !== "active") {
    return {
      allowIdlePrefetch: false,
      allowImagePrefetch: false,
      allowIntentPrefetch: false,
      allowNextPagePrefetch: false,
      quality: currentQuality,
    };
  }

  if (currentQuality === "offline") {
    return {
      allowIdlePrefetch: false,
      allowImagePrefetch: false,
      allowIntentPrefetch: false,
      allowNextPagePrefetch: false,
      quality: "offline",
    };
  }

  if (currentQuality === "degraded") {
    return {
      allowIdlePrefetch: false,
      allowImagePrefetch: false,
      allowIntentPrefetch: true,
      allowNextPagePrefetch: true,
      quality: "degraded",
    };
  }

  if (currentQuality === "unknown") {
    return {
      allowIdlePrefetch: false,
      allowImagePrefetch: false,
      allowIntentPrefetch: true,
      allowNextPagePrefetch: false,
      quality: "unknown",
    };
  }

  return {
    allowIdlePrefetch: true,
    allowImagePrefetch: true,
    allowIntentPrefetch: true,
    allowNextPagePrefetch: true,
    quality: currentQuality || "unknown",
  };
}
