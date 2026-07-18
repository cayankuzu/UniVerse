import React from "react";
import { render } from "@testing-library/react-native";
import {
  getRuntimePerformanceTier,
  resetRuntimePerformanceTierForTests,
} from "../../shared/performance/runtimePerformanceTier";

const mockClearMemoryCache = jest.fn(async () => true);
let mockMemoryWarningHandler: (() => void) | null = null;

jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    addEventListener: (event: string, handler: () => void) => {
      if (event === "memoryWarning") mockMemoryWarningHandler = handler;
      return { remove: jest.fn() };
    },
    currentState: "active",
  },
}));

jest.mock("expo-image", () => ({
  Image: {
    clearMemoryCache: () => mockClearMemoryCache(),
  },
}));

import { AppRuntimePerformanceBridge } from "./AppRuntimePerformanceBridge";

describe("AppRuntimePerformanceBridge", () => {
  beforeEach(() => {
    mockClearMemoryCache.mockClear();
    mockMemoryWarningHandler = null;
    resetRuntimePerformanceTierForTests();
  });

  afterEach(() => {
    resetRuntimePerformanceTierForTests();
  });

  it("drops decoded images and render work after a memory pressure signal", () => {
    render(<AppRuntimePerformanceBridge />);

    mockMemoryWarningHandler?.();

    expect(getRuntimePerformanceTier()).toBe("tier3");
    expect(mockClearMemoryCache).toHaveBeenCalledTimes(1);
  });
});
