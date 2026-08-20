import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import {
  getRuntimePerformanceTier,
  resetRuntimePerformanceTierForTests,
} from "../../shared/performance/runtimePerformanceTier";
import {
  isLowPowerModeEnabled,
  resetResourceConstraintsForTests,
} from "../../shared/performance/resourceConstraints";

const mockClearMemoryCache = jest.fn(async () => true);
let mockMemoryWarningHandler: (() => void) | null = null;
let mockLowPowerModeHandler: ((event: { lowPowerMode: boolean }) => void) | null = null;
const mockIsLowPowerModeEnabledAsync = jest.fn(async () => false);

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

jest.mock("expo-battery", () => ({
  addLowPowerModeListener: (handler: (event: { lowPowerMode: boolean }) => void) => {
    mockLowPowerModeHandler = handler;
    return { remove: jest.fn() };
  },
  isLowPowerModeEnabledAsync: () => mockIsLowPowerModeEnabledAsync(),
}));

import { AppRuntimePerformanceBridge } from "./AppRuntimePerformanceBridge";

describe("AppRuntimePerformanceBridge", () => {
  beforeEach(() => {
    mockClearMemoryCache.mockClear();
    mockMemoryWarningHandler = null;
    mockLowPowerModeHandler = null;
    mockIsLowPowerModeEnabledAsync.mockClear();
    resetResourceConstraintsForTests();
    resetRuntimePerformanceTierForTests();
  });

  afterEach(() => {
    resetRuntimePerformanceTierForTests();
    resetResourceConstraintsForTests();
  });

  it("drops decoded images and render work after a memory pressure signal", () => {
    render(<AppRuntimePerformanceBridge />);

    mockMemoryWarningHandler?.();

    expect(getRuntimePerformanceTier()).toBe("tier3");
    expect(mockClearMemoryCache).toHaveBeenCalledTimes(1);
  });

  it("publishes native low power mode to speculative work budgets", async () => {
    render(<AppRuntimePerformanceBridge />);
    await waitFor(() => expect(mockIsLowPowerModeEnabledAsync).toHaveBeenCalledTimes(1));

    act(() => mockLowPowerModeHandler?.({ lowPowerMode: true }));

    expect(isLowPowerModeEnabled()).toBe(true);
  });

  it("keeps running when the native low-power lookup rejects", async () => {
    mockIsLowPowerModeEnabledAsync.mockRejectedValueOnce(new Error("battery unavailable"));

    const screen = render(<AppRuntimePerformanceBridge />);
    await waitFor(() => expect(mockIsLowPowerModeEnabledAsync).toHaveBeenCalledTimes(1));

    expect(screen.toJSON()).toBeNull();
  });
});
