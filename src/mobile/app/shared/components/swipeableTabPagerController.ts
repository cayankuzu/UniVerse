import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

const PAGE_SELECTION_SYNC_THRESHOLD = 0.08;
const PROGRAMMATIC_SCROLL_GUARD_MS = 700;
const LAZY_RENDER_RADIUS = 1;

function clampPageIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function clampPageProgress(pageOffset: number, total: number) {
  if (!Number.isFinite(pageOffset) || total <= 0) return 0;
  return Math.min(Math.max(pageOffset, 0), total - 1);
}

export function resolvePagedScrollIndex(
  pageOffset: number,
  currentIndex: number,
  total: number,
  threshold = PAGE_SELECTION_SYNC_THRESHOLD,
) {
  const delta = pageOffset - currentIndex;

  if (delta >= threshold) return clampPageIndex(Math.ceil(pageOffset), total);
  if (delta <= -threshold) return clampPageIndex(Math.floor(pageOffset), total);
  return clampPageIndex(currentIndex, total);
}

export function shouldRenderPagedItem(
  index: number,
  anchorIndex: number,
  keepAlive: boolean,
  lazy: boolean,
  radius = LAZY_RENDER_RADIUS,
) {
  if (keepAlive || !lazy) return true;
  return Math.abs(index - anchorIndex) <= radius;
}

export function useProgrammaticScrollGuard() {
  const programmaticScrollRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  const begin = useCallback(() => {
    clear();
    programmaticScrollRef.current = true;
    timerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
      timerRef.current = null;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
  }, [clear]);
  const end = useCallback(() => {
    clear();
    programmaticScrollRef.current = false;
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { begin, end, programmaticScrollRef };
}

type PagerControllerParams<TTab extends string> = {
  activeIndex: number;
  activeTab: TTab;
  getTabAccessibilityLabel?: (tab: TTab) => string;
  onChange: (nextTab: TTab) => void;
  onPageProgressChange?: (pageOffset: number) => void;
  onPreviewTabChange?: (nextTab: TTab) => void;
  tabs: readonly TTab[];
};

export function usePagerController<TTab extends string>({
  activeIndex,
  activeTab,
  getTabAccessibilityLabel,
  onChange,
  onPageProgressChange,
  onPreviewTabChange,
  tabs,
}: PagerControllerParams<TTab>) {
  const currentPageRef = useRef(activeIndex);
  const previewPageRef = useRef(activeIndex);
  const [renderWindowIndex, setRenderWindowIndex] = useState(activeIndex);

  const announceTabChange = useCallback(
    (tab: TTab, index: number) => {
      AccessibilityInfo.announceForAccessibility(
        `${getTabAccessibilityLabel?.(tab) || String(tab)} sekmesi, ${index + 1}/${tabs.length}`,
      );
    },
    [getTabAccessibilityLabel, tabs.length],
  );
  const emitPreviewIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];
      if (!nextTab || previewPageRef.current === clampedIndex) return;
      previewPageRef.current = clampedIndex;
      setRenderWindowIndex(clampedIndex);
      onPreviewTabChange?.(nextTab);
    },
    [onPreviewTabChange, tabs],
  );
  const emitPageProgress = useCallback(
    (pageOffset: number) => {
      onPageProgressChange?.(clampPageProgress(pageOffset, tabs.length));
    },
    [onPageProgressChange, tabs.length],
  );
  const settleTabIndex = useCallback(
    (nextIndex: number, announce = false) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];
      if (!nextTab) return;

      currentPageRef.current = clampedIndex;
      emitPreviewIndex(clampedIndex);
      emitPageProgress(clampedIndex);

      if (nextTab !== activeTab) {
        onChange(nextTab);
        if (announce) announceTabChange(nextTab, clampedIndex);
      }
    },
    [activeTab, announceTabChange, emitPageProgress, emitPreviewIndex, onChange, tabs],
  );
  const syncActiveIndex = useCallback(() => {
    currentPageRef.current = activeIndex;
    previewPageRef.current = activeIndex;
    setRenderWindowIndex(activeIndex);
    emitPageProgress(activeIndex);
    onPreviewTabChange?.(tabs[activeIndex] ?? activeTab);
  }, [activeIndex, activeTab, emitPageProgress, onPreviewTabChange, tabs]);

  return {
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    renderWindowIndex,
    settleTabIndex,
    syncActiveIndex,
  };
}
