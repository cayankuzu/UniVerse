import { create } from "zustand";

export interface UiScreenState {
  hasRenderedContent: boolean;
  lastContentAt: number;
  newContentAvailable: boolean;
}

interface UiViewStateStore {
  acknowledgeContentRendered: (screenKey: string) => void;
  screens: Record<string, UiScreenState>;
  clearNewContent: (screenKey: string) => void;
  markContentRendered: (screenKey: string) => void;
  markNewContentAvailable: (screenKey: string) => void;
  reset: () => void;
}

function createDefaultScreenState(): UiScreenState {
  return {
    hasRenderedContent: false,
    lastContentAt: 0,
    newContentAvailable: false,
  };
}

function updateScreenState(
  screens: Record<string, UiScreenState>,
  screenKey: string,
  updater: (current: UiScreenState) => UiScreenState | null,
) {
  const current = screens[screenKey] || createDefaultScreenState();
  const next = updater(current);
  if (!next || next === current) {
    return null;
  }
  return {
    ...screens,
    [screenKey]: next,
  };
}

export const useUiViewStateStore = create<UiViewStateStore>((set) => ({
  screens: {},
  acknowledgeContentRendered: (screenKey) =>
    set((state) => {
      const nextScreens = updateScreenState(state.screens, screenKey, (current) => {
        if (current.hasRenderedContent && !current.newContentAvailable) {
          return null;
        }
        return {
          ...current,
          hasRenderedContent: true,
          lastContentAt: Date.now(),
          newContentAvailable: false,
        };
      });
      return nextScreens ? { screens: nextScreens } : state;
    }),
  clearNewContent: (screenKey) =>
    set((state) => {
      const nextScreens = updateScreenState(state.screens, screenKey, (current) =>
        current.newContentAvailable
          ? {
              ...current,
              newContentAvailable: false,
            }
          : null,
      );
      return nextScreens ? { screens: nextScreens } : state;
    }),
  markContentRendered: (screenKey) =>
    set((state) => {
      const nextScreens = updateScreenState(state.screens, screenKey, (current) => {
        if (current.hasRenderedContent && !current.newContentAvailable) {
          return null;
        }
        return {
          ...current,
          hasRenderedContent: true,
          lastContentAt: Date.now(),
        };
      });
      return nextScreens ? { screens: nextScreens } : state;
    }),
  markNewContentAvailable: (screenKey) =>
    set((state) => {
      const nextScreens = updateScreenState(state.screens, screenKey, (current) =>
        current.newContentAvailable
          ? null
          : {
              ...current,
              newContentAvailable: true,
            },
      );
      return nextScreens ? { screens: nextScreens } : state;
    }),
  reset: () => set({ screens: {} }),
}));

export function getUiScreenState(screenKey: string): UiScreenState {
  return useUiViewStateStore.getState().screens[screenKey] || createDefaultScreenState();
}

export function selectUiScreenState(screenKey: string) {
  return (state: UiViewStateStore) => state.screens[screenKey] || createDefaultScreenState();
}

export function resetUiViewStateStore() {
  useUiViewStateStore.getState().reset();
}
