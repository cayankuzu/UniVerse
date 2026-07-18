import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const MAIN_BOTTOM_TAB_BASE = 39;
export const MAIN_BOTTOM_TAB_SAFETY_GAP = 10;

export function getMainBottomTabHeight(bottomInset: number) {
  return MAIN_BOTTOM_TAB_BASE + Math.max(bottomInset + 8, 12) + MAIN_BOTTOM_TAB_SAFETY_GAP;
}

export function useBottomNavPadding(extra = 8, min = 12) {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => Math.max(getMainBottomTabHeight(insets.bottom) + extra, min),
    [extra, insets.bottom, min],
  );
}

export function useFloatingBottomMargin(offset = 8, min = 20) {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => Math.max(getMainBottomTabHeight(insets.bottom) + offset, min),
    [insets.bottom, min, offset],
  );
}
