import { memo, useCallback, useRef, useState } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { triggerHapticFeedback, type AppHapticFeedback } from "../feedback/haptics";
import { tokens } from "../theme";

type PressableStyleState = {
  focused?: boolean;
  hovered?: boolean;
  pressed: boolean;
};

type InstantPressableProps = Omit<PressableProps, "onPress" | "style"> & {
  busy?: boolean;
  feedbackOpacity?: number;
  haptic?: AppHapticFeedback;
  onPress?: (event: GestureResponderEvent) => unknown;
  preventRepeatMs?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStyleState) => StyleProp<ViewStyle>);
};

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof (value as { then?: unknown }).then === "function");
}

export const InstantPressable = memo(function InstantPressable({
  accessibilityState,
  busy = false,
  children,
  disabled = false,
  feedbackOpacity = tokens.opacity.pressed,
  haptic,
  onPress,
  preventRepeatMs = 650,
  style,
  ...props
}: InstantPressableProps) {
  const [internalBusy, setInternalBusy] = useState(false);
  const inFlightRef = useRef(false);
  const lastPressAtRef = useRef(0);
  const isDisabled = disabled || busy || internalBusy;

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!onPress || isDisabled || inFlightRef.current) return;
      const now = Date.now();
      if (now - lastPressAtRef.current < preventRepeatMs) return;
      lastPressAtRef.current = now;
      if (haptic) triggerHapticFeedback(haptic);
      const result = onPress(event);
      if (!isPromiseLike(result)) return;
      inFlightRef.current = true;
      setInternalBusy(true);
      void result.then(
        () => {
          inFlightRef.current = false;
          setInternalBusy(false);
        },
        () => {
          inFlightRef.current = false;
          setInternalBusy(false);
        },
      );
    },
    [haptic, isDisabled, onPress, preventRepeatMs],
  );

  const resolveStyle = useCallback(
    (state: PressableStyleState) => {
      const baseStyle = typeof style === "function" ? style(state) : style;
      const activeOpacity =
        state.pressed && !isDisabled ? feedbackOpacity : isDisabled ? tokens.opacity.disabled : 1;
      return [baseStyle, { opacity: activeOpacity }];
    },
    [feedbackOpacity, isDisabled, style],
  );

  return (
    <Pressable
      {...props}
      accessibilityState={{
        ...accessibilityState,
        busy: busy || internalBusy || accessibilityState?.busy,
        disabled: isDisabled || accessibilityState?.disabled,
      }}
      disabled={isDisabled}
      onPress={handlePress}
      style={resolveStyle}
    >
      {children}
    </Pressable>
  );
});

InstantPressable.displayName = "InstantPressable";
