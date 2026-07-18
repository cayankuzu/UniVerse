import { useSyncExternalStore } from "react";

export function createPromptController<TOptions extends object, TResult>(defaultOptions: TOptions) {
  type State = { options: TOptions; requestId: number; visible: boolean };
  type Listener = () => void;

  const listeners = new Set<Listener>();
  let activeResolver: ((value: TResult | null) => void) | null = null;
  let state: State = { options: defaultOptions, requestId: 0, visible: false };

  function emitChange() {
    listeners.forEach((l) => l());
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot() {
    return state;
  }

  function useControllerState() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  function open(options: TOptions = defaultOptions): Promise<TResult | null> {
    if (activeResolver) {
      activeResolver(null);
      activeResolver = null;
    }
    state = { options, requestId: state.requestId + 1, visible: true };
    emitChange();
    return new Promise<TResult | null>((resolve) => {
      activeResolver = resolve;
    });
  }

  function resolve(value: TResult | null) {
    const resolver = activeResolver;
    activeResolver = null;
    state = { ...state, visible: false };
    emitChange();
    resolver?.(value);
  }

  function resetForTests() {
    activeResolver = null;
    state = { options: defaultOptions, requestId: 0, visible: false };
    emitChange();
  }

  return { subscribe, getSnapshot, useControllerState, open, resolve, resetForTests };
}
