import React, {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  InteractionManager,
  Keyboard,
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../shared/theme";
import { AppScrollView, type AppScrollViewProps } from "./AppScrollView";

type FieldLayout = {
  height: number;
  y: number;
};

type FieldRegistration = FieldLayout & {
  target: View | null;
};

export function measureKeyboardSafeField(
  target: View | null,
  contentAnchor: View | null,
  onSuccess: (x: number, y: number, width: number, height: number) => void,
  onFailure: () => void,
) {
  if (!target || !contentAnchor) return false;
  target.measureLayout(contentAnchor, onSuccess, onFailure);
  return true;
}

type KeyboardSafeFormContextValue = {
  focusField: (name: string) => boolean;
  registerField: (name: string, target: View | null) => () => void;
  registerFieldFocus: (name: string, focus: () => void, target?: unknown) => () => void;
  revealField: (name: string) => void;
  setActiveField: (name: string) => void;
  updateFieldLayout: (name: string, layout: FieldLayout) => void;
};

export interface KeyboardSafeFormProps {
  backgroundColor?: string;
  bottomInsetOwner?: "form" | "screen";
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  focusRequest?: KeyboardSafeFormFocusRequest | null;
  header?: ReactNode;
  keyboardVerticalOffset?: number;
  onFocusRequestHandled?: (request: KeyboardSafeFormFocusRequest, focused: boolean) => void;
  scrollProps?: Omit<AppScrollViewProps, "children" | "contentContainerStyle">;
  stickyAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export type KeyboardSafeFormFocusRequest = {
  fieldName: string;
  revision: number;
};

const KeyboardSafeFormContext = createContext<KeyboardSafeFormContextValue | null>(null);

export function useKeyboardSafeField(name?: string) {
  const context = useContext(KeyboardSafeFormContext);
  const cleanupRef = useRef<(() => void) | null>(null);

  const registerRef = useCallback(
    (node: View | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!name || !node) return;
      cleanupRef.current = context?.registerField(name, node) ?? null;
    },
    [context, name],
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!name) return;
      context?.updateFieldLayout(name, {
        height: event.nativeEvent.layout.height,
        y: event.nativeEvent.layout.y,
      });
    },
    [context, name],
  );

  const onFocus = useCallback(() => {
    if (!name) return;
    context?.setActiveField(name);
    context?.revealField(name);
  }, [context, name]);

  return { onFocus, onLayout, ref: registerRef };
}

export function useKeyboardSafeFormActions() {
  return useContext(KeyboardSafeFormContext);
}

export function KeyboardSafeForm({
  backgroundColor = tokens.colors.background,
  bottomInsetOwner = "form",
  children,
  contentContainerStyle,
  focusRequest,
  header,
  keyboardVerticalOffset = 0,
  onFocusRequestHandled,
  scrollProps,
  stickyAction,
  style,
}: KeyboardSafeFormProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const contentAnchorRef = useRef<View>(null);
  const fieldLayouts = useRef(new Map<string, FieldRegistration>());
  const fieldFocusHandlers = useRef(new Map<string, { focus: () => void; target?: unknown }>());
  const activeFieldName = useRef<string | null>(null);
  const scrollOffsetY = useRef(0);
  const viewportHeight = useRef(0);
  const stickyActionHeight = useRef(0);
  const keyboardHeightRef = useRef(0);
  const manualScrollUntil = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const setActiveField = useCallback((name: string) => {
    activeFieldName.current = name;
  }, []);

  const updateFieldLayout = useCallback((name: string, layout: FieldLayout) => {
    const current = fieldLayouts.current.get(name);
    fieldLayouts.current.set(name, {
      height: layout.height,
      target: current?.target ?? null,
      y: layout.y,
    });
  }, []);

  const registerField = useCallback((name: string, target: View | null) => {
    const current = fieldLayouts.current.get(name);
    fieldLayouts.current.set(name, {
      height: current?.height ?? 0,
      target,
      y: current?.y ?? 0,
    });

    return () => {
      const registered = fieldLayouts.current.get(name);
      if (registered?.target === target) {
        fieldLayouts.current.delete(name);
      }
    };
  }, []);

  const revealMeasuredField = useCallback(
    (name: string, layout: FieldLayout) => {
      if (Date.now() < manualScrollUntil.current) return;

      const currentOffset = scrollOffsetY.current;
      const visiblePadding = tokens.spacing.md;
      const androidKeyboardInset = viewportHeight.current
        ? Math.min(keyboardHeightRef.current, viewportHeight.current * 0.35)
        : 0;
      const keyboardInset =
        Platform.OS === "ios" ? keyboardHeightRef.current : androidKeyboardInset;
      const visibleTop = currentOffset + visiblePadding;
      const visibleBottom =
        currentOffset +
        viewportHeight.current -
        keyboardInset -
        stickyActionHeight.current -
        Math.max(insets.bottom, visiblePadding);
      const fieldTop = layout.y;
      const fieldBottom = layout.y + layout.height;
      let nextY: number | null = null;

      if (fieldTop < visibleTop) {
        nextY = Math.max(0, fieldTop - visiblePadding);
      } else if (fieldBottom > visibleBottom) {
        nextY = Math.max(0, currentOffset + fieldBottom - visibleBottom + visiblePadding);
      }

      if (nextY === null || Math.abs(nextY - currentOffset) < 4) return;

      scrollRef.current?.scrollTo({
        animated: true,
        y: nextY,
      });
    },
    [insets.bottom],
  );

  const revealField = useCallback(
    (name: string) => {
      const field = fieldLayouts.current.get(name);
      if (!field) return;

      const contentAnchor = contentAnchorRef.current;

      if (
        measureKeyboardSafeField(
          field.target,
          contentAnchor,
          (_x, y, _width, height) => {
            revealMeasuredField(name, {
              height: height || field.height,
              y,
            });
          },
          () => revealMeasuredField(name, field),
        )
      ) {
        return;
      }

      revealMeasuredField(name, field);
    },
    [revealMeasuredField],
  );

  useEffect(() => {
    const updateKeyboardHeight = (height: number) => {
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
      window.setTimeout(() => {
        const activeName = activeFieldName.current;
        if (activeName) {
          revealField(activeName);
        }
      }, 40);
    };
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      updateKeyboardHeight(Math.max(0, event.endCoordinates.height - keyboardVerticalOffset));
    });
    const changeSubscription = Keyboard.addListener("keyboardDidChangeFrame", (event) => {
      updateKeyboardHeight(Math.max(0, event.endCoordinates.height - keyboardVerticalOffset));
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      updateKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      changeSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardVerticalOffset, revealField]);

  const registerFieldFocus = useCallback((name: string, focus: () => void, target?: unknown) => {
    fieldFocusHandlers.current.set(name, { focus, target });

    return () => {
      const current = fieldFocusHandlers.current.get(name);
      if (current?.focus === focus) {
        fieldFocusHandlers.current.delete(name);
      }
    };
  }, []);

  const focusField = useCallback(
    (name: string) => {
      const focusable = fieldFocusHandlers.current.get(name);
      if (!focusable) return false;
      activeFieldName.current = name;
      revealField(name);
      focusable.focus();
      window.setTimeout(() => revealField(name), 120);

      const targetHandle = focusable.target
        ? findNodeHandle(focusable.target as Parameters<typeof findNodeHandle>[0])
        : null;
      if (targetHandle) {
        window.setTimeout(() => {
          AccessibilityInfo.setAccessibilityFocus(targetHandle);
        }, 80);
      }
      return true;
    },
    [revealField],
  );

  useEffect(() => {
    const requestedName = focusRequest?.fieldName?.trim();
    if (!requestedName) return undefined;
    const request: KeyboardSafeFormFocusRequest = {
      fieldName: requestedName,
      revision: focusRequest?.revision ?? 0,
    };

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      window.setTimeout(() => {
        if (cancelled) return;
        const focused = focusField(requestedName);
        onFocusRequestHandled?.(request, focused);
      }, 32);
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [focusField, focusRequest?.fieldName, focusRequest?.revision, onFocusRequestHandled]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetY.current = event.nativeEvent.contentOffset.y;
      scrollProps?.onScroll?.(event);
    },
    [scrollProps],
  );

  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      manualScrollUntil.current = Date.now() + 450;
      scrollProps?.onScrollBeginDrag?.(event);
    },
    [scrollProps],
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      manualScrollUntil.current = Date.now() + 180;
      scrollProps?.onScrollEndDrag?.(event);
    },
    [scrollProps],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      manualScrollUntil.current = 0;
      scrollProps?.onMomentumScrollEnd?.(event);
    },
    [scrollProps],
  );

  const handleScrollLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      scrollProps?.onLayout?.(event);
    },
    [scrollProps],
  );

  const contextValue = useMemo(
    () => ({
      focusField,
      registerField,
      registerFieldFocus,
      revealField,
      setActiveField,
      updateFieldLayout,
    }),
    [focusField, registerField, registerFieldFocus, revealField, setActiveField, updateFieldLayout],
  );
  const bottomPadding = bottomInsetOwner === "form" ? Math.max(insets.bottom + 16, 28) : 28;
  const keyboardInset = Platform.OS === "ios" ? keyboardHeight : 0;
  const stickyPaddingBottom =
    (bottomInsetOwner === "screen" ? 16 : Math.max(insets.bottom + 12, 20)) + keyboardInset;

  return (
    <View style={[{ flex: 1, backgroundColor }, style]}>
      {header}
      <KeyboardSafeFormContext.Provider value={contextValue}>
        <AppScrollView
          {...scrollProps}
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingBottom: stickyAction
                ? bottomPadding + 72 + keyboardInset
                : bottomPadding + keyboardInset,
              paddingHorizontal: tokens.spacing.xl,
              paddingTop: tokens.spacing.lg,
            },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? "handled"}
          onLayout={handleScrollLayout}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
        >
          <View ref={contentAnchorRef} collapsable={false} style={{ height: 0 }} />
          {children}
        </AppScrollView>
        {stickyAction ? (
          <View
            onLayout={(event) => {
              stickyActionHeight.current = event.nativeEvent.layout.height;
            }}
            style={{
              borderTopColor: tokens.colors.border,
              borderTopWidth: 1,
              paddingBottom: stickyPaddingBottom,
              paddingHorizontal: tokens.spacing.xl,
              paddingTop: tokens.spacing.sm,
            }}
          >
            {stickyAction}
          </View>
        ) : null}
      </KeyboardSafeFormContext.Provider>
    </View>
  );
}
