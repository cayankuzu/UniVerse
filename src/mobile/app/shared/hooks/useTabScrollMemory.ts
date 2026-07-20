import { useCallback, useRef } from "react";

export type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

const OFFSET_EPSILON = 2;

function normalizeOffset(offset: number) {
  return Number.isFinite(offset) ? Math.max(0, offset) : 0;
}

function restoreOffset(handle: ScrollToOffsetHandle, offset: number, force = false) {
  const nextOffset = normalizeOffset(offset);
  if (!force && nextOffset <= OFFSET_EPSILON) return;
  try {
    handle.scrollToOffset({ animated: false, offset: nextOffset });
  } catch {
    // A newly mounted native list can reject restoration until it has content.
  }
}

export function useTabScrollMemory<TTab extends string>() {
  const refs = useRef<Partial<Record<TTab, ScrollToOffsetHandle | null>>>({});
  const offsets = useRef<Partial<Record<TTab, number>>>({});
  const refCallbacks = useRef<Partial<Record<TTab, (handle: ScrollToOffsetHandle | null) => void>>>(
    {},
  );

  const setTabScrollRef = useCallback((tab: TTab, handle: ScrollToOffsetHandle | null) => {
    if (!handle) {
      delete refs.current[tab];
      return;
    }
    if (refs.current[tab] === handle) return;
    refs.current[tab] = handle;
    restoreOffset(handle, offsets.current[tab] ?? 0);
  }, []);

  const getTabScrollRefCallback = useCallback(
    (tab: TTab) => {
      refCallbacks.current[tab] ??= (handle) => setTabScrollRef(tab, handle);
      return refCallbacks.current[tab];
    },
    [setTabScrollRef],
  );

  const recordTabScrollOffset = useCallback((tab: TTab, offset: number) => {
    const nextOffset = normalizeOffset(offset);
    if (Math.abs(nextOffset - (offsets.current[tab] ?? 0)) < OFFSET_EPSILON) return;
    offsets.current[tab] = nextOffset;
  }, []);

  const getTabScrollRef = useCallback((tab: TTab) => refs.current[tab] ?? null, []);
  const restoreTabScrollOffset = useCallback((tab: TTab) => {
    const handle = refs.current[tab];
    if (!handle) return;
    restoreOffset(handle, offsets.current[tab] ?? 0, true);
  }, []);

  return {
    getTabScrollRef,
    getTabScrollRefCallback,
    recordTabScrollOffset,
    restoreTabScrollOffset,
    setTabScrollRef,
  };
}
