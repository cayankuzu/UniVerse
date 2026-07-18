import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import {
  TabReselectProvider,
  useTabReselectCounter,
  useTriggerTabReselect,
} from "./TabReselectContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <TabReselectProvider>{children}</TabReselectProvider>;
}

describe("TabReselectContext", () => {
  it("increments the selected tab counter through the action hook", () => {
    const { result } = renderHook(
      () => ({
        count: useTabReselectCounter("home"),
        triggerTabReselect: useTriggerTabReselect(),
      }),
      { wrapper },
    );

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.triggerTabReselect("home");
    });

    expect(result.current.count).toBe(1);
  });
});
