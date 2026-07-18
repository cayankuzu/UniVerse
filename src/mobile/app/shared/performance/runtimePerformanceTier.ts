import { useSyncExternalStore } from "react";
import type { PerformanceTier } from "./performanceBudget";

type Listener = () => void;

const TIER_WEIGHT: Record<PerformanceTier, number> = {
  tier1: 1,
  tier2: 2,
  tier3: 3,
};

const listeners = new Set<Listener>();
let runtimePerformanceTier: PerformanceTier = "tier1";

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRuntimePerformanceTier() {
  return runtimePerformanceTier;
}

export function useRuntimePerformanceTier() {
  return useSyncExternalStore(subscribe, getRuntimePerformanceTier, getRuntimePerformanceTier);
}

export function degradeRuntimePerformanceTier(tier: PerformanceTier = "tier3") {
  if (TIER_WEIGHT[tier] <= TIER_WEIGHT[runtimePerformanceTier]) return;
  runtimePerformanceTier = tier;
  emitChange();
}

export function resolveRuntimePerformanceTier(
  requestedTier: PerformanceTier,
  runtimeTier: PerformanceTier,
) {
  return TIER_WEIGHT[runtimeTier] > TIER_WEIGHT[requestedTier] ? runtimeTier : requestedTier;
}

export function resetRuntimePerformanceTierForTests() {
  runtimePerformanceTier = "tier1";
  emitChange();
}
