import { useEffect, useRef } from "react";

type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

interface UseScrollToTopOnReselectParams {
  listRef: React.MutableRefObject<ScrollToOffsetHandle | null>;
  onReselect?: () => void;
  reselectCounter: number;
}

export function useScrollToTopOnReselect({
  listRef,
  onReselect,
  reselectCounter,
}: UseScrollToTopOnReselectParams) {
  const onReselectRef = useRef(onReselect);

  useEffect(() => {
    onReselectRef.current = onReselect;
  }, [onReselect]);

  useEffect(() => {
    if (!reselectCounter) return;
    onReselectRef.current?.();
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [listRef, reselectCounter]);
}
