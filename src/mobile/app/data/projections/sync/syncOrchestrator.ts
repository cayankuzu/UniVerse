import type { QueryKey } from "@tanstack/react-query";
import { create } from "zustand";
import { logError } from "../../../platform/observability";
import { runLowPriorityTask } from "../../../shared/utils/lowPriorityTaskScheduler";
import type { ProjectionPrefetchPolicy } from "../policies/projectionFreshness";

export interface RegisteredProjectionSync {
  entity: string;
  freshnessSlaMs: number;
  initialLastSyncedAt?: number;
  isStale?: () => boolean;
  lastSyncedAt: number;
  prefetchPolicy: ProjectionPrefetchPolicy;
  queryKey: QueryKey;
  sync: () => Promise<unknown>;
}

interface SyncOrchestratorStore {
  projections: Record<string, RegisteredProjectionSync>;
  noteSync: (screenKey: string, syncedAt?: number) => void;
  registerProjection: (
    screenKey: string,
    projection: Omit<RegisteredProjectionSync, "lastSyncedAt">,
  ) => void;
  reset: () => void;
  unregisterProjection: (screenKey: string) => void;
}

const scheduledSyncs = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightSyncs = new Set<string>();

function doesQueryKeyStartWith(queryKey: QueryKey, prefix: QueryKey) {
  if (prefix.length > queryKey.length) return false;
  return prefix.every((part, index) => queryKey[index] === part);
}

function clearScheduledProjectionSync(screenKey: string) {
  const timer = scheduledSyncs.get(screenKey);
  if (!timer) return;
  clearTimeout(timer);
  scheduledSyncs.delete(screenKey);
}

function forEachRegisteredProjectionSync(
  callback: (screenKey: string, projection: RegisteredProjectionSync) => void,
) {
  Object.entries(useSyncOrchestratorStore.getState().projections).forEach(
    ([screenKey, projection]) => {
      callback(screenKey, projection);
    },
  );
}

export const useSyncOrchestratorStore = create<SyncOrchestratorStore>((set) => ({
  projections: {},
  noteSync: (screenKey, syncedAt = Date.now()) =>
    set((state) => {
      const current = state.projections[screenKey];
      if (!current) return state;
      return {
        projections: {
          ...state.projections,
          [screenKey]: {
            ...current,
            lastSyncedAt: syncedAt,
          },
        },
      };
    }),
  registerProjection: (screenKey, projection) =>
    set((state) => ({
      projections: {
        ...state.projections,
        [screenKey]: {
          ...projection,
          lastSyncedAt: Math.max(
            state.projections[screenKey]?.lastSyncedAt || 0,
            Number(projection.initialLastSyncedAt || 0),
          ),
        },
      },
    })),
  reset: () => {
    Array.from(scheduledSyncs.keys()).forEach(clearScheduledProjectionSync);
    scheduledSyncs.clear();
    inFlightSyncs.clear();
    set({ projections: {} });
  },
  unregisterProjection: (screenKey) =>
    set((state) => {
      clearScheduledProjectionSync(screenKey);
      const next = { ...state.projections };
      delete next[screenKey];
      return { projections: next };
    }),
}));

export function registerProjectionSync(
  screenKey: string,
  projection: Omit<RegisteredProjectionSync, "lastSyncedAt">,
) {
  useSyncOrchestratorStore.getState().registerProjection(screenKey, projection);
}

export function unregisterProjectionSync(screenKey: string) {
  useSyncOrchestratorStore.getState().unregisterProjection(screenKey);
}

export function noteProjectionSync(screenKey: string, syncedAt = Date.now()) {
  useSyncOrchestratorStore.getState().noteSync(screenKey, syncedAt);
}

export function getRegisteredProjectionSync(screenKey: string) {
  return useSyncOrchestratorStore.getState().projections[screenKey] || null;
}

export function getRegisteredProjectionSyncEntries() {
  return Object.entries(useSyncOrchestratorStore.getState().projections);
}

export function resetSyncOrchestratorStore() {
  useSyncOrchestratorStore.getState().reset();
}

function shouldDeferProjectionSync(projection: RegisteredProjectionSync, now = Date.now()) {
  if (projection.isStale?.()) return false;
  if (projection.lastSyncedAt <= 0) return false;
  return now - projection.lastSyncedAt < Math.max(0, projection.freshnessSlaMs);
}

export async function runProjectionSync(screenKey: string) {
  clearScheduledProjectionSync(screenKey);
  if (inFlightSyncs.has(screenKey)) return;
  const projection = useSyncOrchestratorStore.getState().projections[screenKey];
  if (!projection) return;
  inFlightSyncs.add(screenKey);
  try {
    await projection.sync();
    noteProjectionSync(screenKey);
  } catch (error) {
    logError(error, {
      captureInSentry: false,
      meta: { entity: projection.entity, screenKey },
      name: "projection-sync-failed",
    });
  } finally {
    inFlightSyncs.delete(screenKey);
  }
}

export function scheduleProjectionSync(screenKey: string, delayMs = 320) {
  const projection = useSyncOrchestratorStore.getState().projections[screenKey];
  if (!projection) return;
  if (scheduledSyncs.has(screenKey)) return;
  if (shouldDeferProjectionSync(projection)) return;
  const timer = setTimeout(
    () => {
      scheduledSyncs.delete(screenKey);
      void runLowPriorityTask(() => runProjectionSync(screenKey), {
        key: `projection-sync:${screenKey}`,
      });
    },
    Math.max(0, delayMs),
  );
  scheduledSyncs.set(screenKey, timer);
}

function scheduleProjectionSyncWhere(
  predicate: (projection: RegisteredProjectionSync, screenKey: string) => boolean,
  delayMs = 0,
) {
  const now = Date.now();
  forEachRegisteredProjectionSync((screenKey, projection) => {
    if (!predicate(projection, screenKey)) return;
    if (shouldDeferProjectionSync(projection, now)) return;
    scheduleProjectionSync(screenKey, delayMs);
  });
}

export function scheduleProjectionSyncByEntity(entity: string | string[], delayMs = 0) {
  const entitySet = new Set(
    (Array.isArray(entity) ? entity : [entity])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  );
  if (!entitySet.size) return;
  scheduleProjectionSyncWhere((projection) => entitySet.has(projection.entity), delayMs);
}

export function scheduleProjectionSyncByQueryPrefix(queryKey: QueryKey, delayMs = 0) {
  if (!queryKey.length) return;
  scheduleProjectionSyncWhere(
    (projection) => doesQueryKeyStartWith(projection.queryKey, queryKey),
    delayMs,
  );
}

export function scheduleStaleProjectionSyncs() {
  const now = Date.now();
  forEachRegisteredProjectionSync((screenKey, projection) => {
    if (shouldDeferProjectionSync(projection, now)) return;
    scheduleProjectionSync(screenKey, 0);
  });
}
