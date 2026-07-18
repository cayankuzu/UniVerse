import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import {
  ChromeVisibilityProvider,
  useBottomTabsVisible,
  useSetBottomTabsVisible,
} from "./ChromeVisibilityContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ChromeVisibilityProvider>{children}</ChromeVisibilityProvider>;
}

describe("ChromeVisibilityContext", () => {
  it("updates bottom tab visibility through the action hook", () => {
    const { result } = renderHook(
      () => ({
        setBottomTabsVisible: useSetBottomTabsVisible(),
        visible: useBottomTabsVisible(),
      }),
      { wrapper },
    );

    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.setBottomTabsVisible(false);
    });

    expect(result.current.visible).toBe(false);
  });
});
