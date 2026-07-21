import { useEffect, useRef } from "react";

type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

interface UseScrollToTopOnReselectParams {
  listRef: React.MutableRefObject<ScrollToOffsetHandle | null>;
  onReselect?: () => void;
  onSecondReselect?: () => void;
  reselectCounter: number;
}

const SECOND_RESELECT_WINDOW_MS = 1_200;

export function useScrollToTopOnReselect({
  listRef,
  onReselect,
  onSecondReselect,
  reselectCounter,
}: UseScrollToTopOnReselectParams) {
  const onReselectRef = useRef(onReselect);
  const onSecondReselectRef = useRef(onSecondReselect);
  const lastReselectAtRef = useRef(0);

  useEffect(() => {
    onReselectRef.current = onReselect;
  }, [onReselect]);

  useEffect(() => {
    onSecondReselectRef.current = onSecondReselect;
  }, [onSecondReselect]);

  useEffect(() => {
    if (!reselectCounter) return;
    const now = Date.now();
    const isSecondReselect = now - lastReselectAtRef.current <= SECOND_RESELECT_WINDOW_MS;
    lastReselectAtRef.current = now;
    onReselectRef.current?.();
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (isSecondReselect) onSecondReselectRef.current?.();
  }, [listRef, reselectCounter]);
}
