import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import type { AppFlatListRef } from "../../../../shared/components";
import { scheduleAfterInteractions } from "../../../../shared/utils/scheduleAfterInteractions";
import { prepareViewerData, resolveViewerListInstanceKey } from "./viewerTarget";
import { reportContentCardUiError } from "../../application/contentCardUiLogging";

type ViewerListType = "albums" | "events";

export function useDetailViewerOverlayState<T extends { id: string }>(params: {
  data: T[];
  initialIndex: number;
  initialItemId?: string | null;
  listType: ViewerListType;
  onClose: () => void;
  visible: boolean;
}) {
  const { onClose, visible } = params;
  const insets = useSafeAreaInsets();
  const bottomNavPadding = useBottomNavPadding(12, 28);
  const listRef = useRef<AppFlatListRef<T>>(null);
  const [showList, setShowList] = useState(false);
  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      gap: 12,
      paddingBottom: Math.max(bottomNavPadding + 10, insets.bottom + 28),
      paddingHorizontal: 0,
      paddingTop: 10,
    }),
    [bottomNavPadding, insets.bottom],
  );
  const viewerData = useMemo(
    () =>
      prepareViewerData({
        data: params.data,
        initialIndex: params.initialIndex,
        initialItemId: params.initialItemId,
      }),
    [params.data, params.initialIndex, params.initialItemId],
  );
  const listInstanceKey = useMemo(
    () =>
      resolveViewerListInstanceKey({
        initialIndex: params.initialIndex,
        initialItemId: params.initialItemId,
        listType: params.listType,
        totalItems: viewerData.data.length,
      }),
    [params.initialIndex, params.initialItemId, params.listType, viewerData.data.length],
  );
  const focusedItem = viewerData.data[viewerData.initialIndex] || viewerData.data[0] || null;

  useEffect(() => {
    if (!params.visible) {
      setShowList(false);
      return;
    }
    setShowList(false);
    let frame = 0;
    const task = scheduleAfterInteractions(() => {
      frame = requestAnimationFrame(() => setShowList(true));
    }, 0);
    return () => {
      task.cancel();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [listInstanceKey, params.visible]);

  useEffect(() => {
    if (!showList || !params.visible || !viewerData.data.length || viewerData.initialIndex === 0) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      void listRef.current
        ?.scrollToIndex({
          animated: false,
          index: viewerData.initialIndex,
        })
        .catch((error) => {
          reportContentCardUiError(error, "detail-viewer-scroll-to-index", {
            index: viewerData.initialIndex,
          });
          listRef.current?.scrollToOffset({
            animated: false,
            offset: Math.max(0, viewerData.initialIndex * 420),
          });
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [params.visible, showList, viewerData]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  return {
    contentContainerStyle,
    focusedItem,
    listInstanceKey,
    listRef,
    showList,
    viewerData,
  };
}
