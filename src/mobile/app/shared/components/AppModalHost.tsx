import React, { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Modal, View, type ModalProps } from "react-native";

type FocusableRef = RefObject<unknown>;

export type AppModalHostProps = Omit<ModalProps, "children" | "onRequestClose"> & {
  accessibilityAnnouncement?: string;
  children: ReactNode;
  initialFocusRef?: FocusableRef;
  onRequestClose: () => void;
  restoreFocusRef?: FocusableRef;
};

function moveAccessibilityFocus(ref?: FocusableRef) {
  const current = ref?.current;
  if (!current) return;

  const focusable = current as { focus?: () => void };
  if (typeof focusable.focus === "function") {
    setTimeout(() => focusable.focus?.(), 40);
  }

  let handle: ReturnType<typeof findNodeHandle> = null;
  try {
    handle = findNodeHandle(current as Parameters<typeof findNodeHandle>[0]);
  } catch {
    // Some imperative focus handles are not native host instances.
  }
  if (!handle) return;
  setTimeout(() => AccessibilityInfo.setAccessibilityFocus(handle), 80);
}

/**
 * The only production boundary allowed to mount React Native's native Modal.
 * Keeping this behavior centralized makes screen-reader isolation, escape/back,
 * announcement and focus restoration consistent across every modal surface.
 */
export function AppModalHost({
  accessibilityAnnouncement,
  children,
  initialFocusRef,
  onDismiss,
  onRequestClose,
  onShow,
  restoreFocusRef,
  testID,
  visible = false,
  ...modalProps
}: AppModalHostProps) {
  const wasVisibleRef = useRef(false);

  const announceAndFocus = useCallback(() => {
    if (accessibilityAnnouncement) {
      AccessibilityInfo.announceForAccessibility(accessibilityAnnouncement);
    }
    moveAccessibilityFocus(initialFocusRef);
  }, [accessibilityAnnouncement, initialFocusRef]);

  useEffect(() => {
    if (!visible && wasVisibleRef.current) {
      moveAccessibilityFocus(restoreFocusRef);
    }
    wasVisibleRef.current = visible;
  }, [restoreFocusRef, visible]);

  return (
    <Modal
      {...modalProps}
      testID={testID}
      visible={visible}
      onDismiss={onDismiss}
      onRequestClose={onRequestClose}
      onShow={(event) => {
        announceAndFocus();
        onShow?.(event);
      }}
    >
      <View
        accessibilityViewIsModal
        collapsable={false}
        importantForAccessibility="yes"
        onAccessibilityEscape={onRequestClose}
        style={{ flex: 1 }}
        testID={testID ? `${testID}-a11y-root` : undefined}
      >
        {children}
      </View>
    </Modal>
  );
}
