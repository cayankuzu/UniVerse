import React, { type RefObject } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppModalHost } from "./AppModalHost";

let mockReducedMotion = false;

jest.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

describe("AppModalHost", () => {
  beforeEach(() => {
    mockReducedMotion = false;
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(jest.fn());
  });

  it("disables native modal motion when the system requests reduced motion", () => {
    mockReducedMotion = true;

    render(
      <AppModalHost animationType="fade" onRequestClose={jest.fn()} testID="motion-modal" visible>
        <Text>İçerik</Text>
      </AppModalHost>,
    );

    expect(screen.getByTestId("motion-modal").props.animationType).toBe("none");
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("centralizes announcement, escape handling and focus restoration", () => {
    const initialFocus = jest.fn();
    const restoreFocus = jest.fn();
    const onRequestClose = jest.fn();
    const initialFocusRef = { current: { focus: initialFocus } } as RefObject<unknown>;
    const restoreFocusRef = { current: { focus: restoreFocus } } as RefObject<unknown>;
    const rendered = render(
      <AppModalHost
        accessibilityAnnouncement="Profil seçenekleri"
        initialFocusRef={initialFocusRef}
        onRequestClose={onRequestClose}
        restoreFocusRef={restoreFocusRef}
        testID="profile-menu"
        visible
      >
        <Text>İçerik</Text>
      </AppModalHost>,
    );

    fireEvent(screen.getByTestId("profile-menu"), "show");
    act(() => jest.runOnlyPendingTimers());
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Profil seçenekleri");
    expect(initialFocus).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId("profile-menu-a11y-root"), "accessibilityEscape");
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    rendered.rerender(
      <AppModalHost
        initialFocusRef={initialFocusRef}
        onRequestClose={onRequestClose}
        restoreFocusRef={restoreFocusRef}
        testID="profile-menu"
        visible={false}
      >
        <Text>İçerik</Text>
      </AppModalHost>,
    );
    act(() => jest.runOnlyPendingTimers());
    expect(restoreFocus).toHaveBeenCalledTimes(1);
  });
});
