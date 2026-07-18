import { forwardRef, type ForwardedRef } from "react";
import { Platform, ScrollView, type ScrollViewProps } from "react-native";

export interface AppScrollViewProps extends ScrollViewProps {
  axis?: "horizontal" | "vertical";
}

function AppScrollViewInner(
  {
    axis,
    automaticallyAdjustKeyboardInsets,
    directionalLockEnabled = true,
    contentInsetAdjustmentBehavior,
    horizontal,
    keyboardDismissMode,
    keyboardShouldPersistTaps,
    nestedScrollEnabled = true,
    scrollEventThrottle = 16,
    showsHorizontalScrollIndicator,
    showsVerticalScrollIndicator,
    ...rest
  }: AppScrollViewProps,
  ref: ForwardedRef<ScrollView>,
) {
  const isHorizontal = Boolean(horizontal ?? axis === "horizontal");

  return (
    <ScrollView
      {...rest}
      ref={ref}
      automaticallyAdjustKeyboardInsets={
        automaticallyAdjustKeyboardInsets ?? (!isHorizontal && Platform.OS === "ios")
      }
      contentInsetAdjustmentBehavior={
        contentInsetAdjustmentBehavior ?? (isHorizontal ? undefined : "automatic")
      }
      horizontal={isHorizontal}
      directionalLockEnabled={directionalLockEnabled}
      keyboardDismissMode={
        keyboardDismissMode ??
        (isHorizontal ? undefined : Platform.OS === "ios" ? "interactive" : "on-drag")
      }
      keyboardShouldPersistTaps={
        keyboardShouldPersistTaps ?? (isHorizontal ? undefined : "handled")
      }
      nestedScrollEnabled={nestedScrollEnabled}
      scrollEventThrottle={scrollEventThrottle}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator ?? false}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? false}
    />
  );
}

export const AppScrollView = forwardRef(AppScrollViewInner);
AppScrollView.displayName = "AppScrollView";
