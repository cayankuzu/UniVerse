import { create } from "zustand";

export type OptimisticOutboxStatus = "failed" | "pending" | "resolved";

export interface OptimisticOutboxEntry {
  action: string;
  entity: string;
  errorMessage?: string;
  id: string;
  startedAt: number;
  status: OptimisticOutboxStatus;
}

interface OptimisticOutboxMetaStore {
  entries: Record<string, OptimisticOutboxEntry>;
  begin: (entry: Omit<OptimisticOutboxEntry, "startedAt" | "status">) => void;
  fail: (id: string, errorMessage?: string) => void;
  reset: () => void;
  resolve: (id: string) => void;
}

export const useOptimisticOutboxMetaStore = create<OptimisticOutboxMetaStore>((set) => ({
  entries: {},
  begin: (entry) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [entry.id]: {
          ...entry,
          startedAt: Date.now(),
          status: "pending",
        },
      },
    })),
  fail: (id, errorMessage) =>
    set((state) => {
      const current = state.entries[id];
      if (!current) return state;
      return {
        entries: {
          ...state.entries,
          [id]: {
            ...current,
            errorMessage,
            status: "failed",
          },
        },
      };
    }),
  reset: () => set({ entries: {} }),
  resolve: (id) =>
    set((state) => {
      const current = state.entries[id];
      if (!current) return state;
      return {
        entries: {
          ...state.entries,
          [id]: {
            ...current,
            status: "resolved",
          },
        },
      };
    }),
}));

export function getOptimisticOutboxEntry(id: string) {
  return useOptimisticOutboxMetaStore.getState().entries[id] || null;
}

export function selectOptimisticOutboxEntry(id: string) {
  return (state: OptimisticOutboxMetaStore) => state.entries[id] || null;
}

export function resetOptimisticOutboxMetaStore() {
  useOptimisticOutboxMetaStore.getState().reset();
}
