import type React from "react";
import { UIManager } from "react-native";

export type NativePagerViewHandle = {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
};

export type NativePagerViewOnPageScrollEvent = {
  nativeEvent: {
    offset: number;
    position: number;
  };
};

export type NativePagerViewOnPageSelectedEvent = {
  nativeEvent: {
    position: number;
  };
};

export type NativePagerViewOnPageScrollStateChangedEvent = {
  nativeEvent: {
    pageScrollState: "dragging" | "idle" | "settling";
  };
};

export type NativePagerViewProps = {
  children: React.ReactNode;
  initialPage: number;
  offscreenPageLimit?: number;
  onPageScroll?: (event: NativePagerViewOnPageScrollEvent) => void;
  onPageScrollStateChanged?: (event: NativePagerViewOnPageScrollStateChangedEvent) => void;
  onPageSelected: (event: NativePagerViewOnPageSelectedEvent) => void;
  scrollEnabled: boolean;
  style: unknown;
};

type UIManagerLookup = {
  getViewManagerConfig?: (name: string) => unknown;
};

const PAGER_VIEW_MANAGER_NAMES = ["RNCViewPager", "RCTRNCViewPager"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoadableComponent(value: unknown) {
  return typeof value === "function" || isRecord(value);
}

export function hasNativePagerView(uiManager: UIManagerLookup = UIManager) {
  if (typeof uiManager.getViewManagerConfig !== "function") {
    return false;
  }

  return PAGER_VIEW_MANAGER_NAMES.some((name) => {
    try {
      return uiManager.getViewManagerConfig?.(name) != null;
    } catch {
      return false;
    }
  });
}

export function loadNativePagerView(
  loadModule = () => require("react-native-pager-view") as unknown,
  uiManager: UIManagerLookup = UIManager,
) {
  if (!hasNativePagerView(uiManager)) {
    return null;
  }

  try {
    const module = loadModule();
    const candidate = isRecord(module) && "default" in module ? module.default : module;

    return isLoadableComponent(candidate)
      ? (candidate as React.ComponentType<
          NativePagerViewProps & React.RefAttributes<NativePagerViewHandle>
        >)
      : null;
  } catch {
    return null;
  }
}
