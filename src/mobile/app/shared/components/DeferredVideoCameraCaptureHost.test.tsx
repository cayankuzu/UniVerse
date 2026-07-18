import React from "react";
import { act, render, screen } from "@testing-library/react-native";

const mockCameraHostModuleLoaded = jest.fn();
const mockScheduledTasks: Array<{ callback: () => void; delayMs: number }> = [];

jest.mock("../media/videoCameraCaptureController", () => ({
  useVideoCameraCaptureState: jest.fn(() => ({ visible: false })),
}));

jest.mock("../utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: (callback: () => void, delayMs: number) => {
    mockScheduledTasks.push({ callback, delayMs });
    return { cancel: jest.fn() };
  },
}));

jest.mock("./VideoCameraCaptureHost", () => {
  const React = require("react");
  const { Text } = require("react-native");
  mockCameraHostModuleLoaded();
  return {
    __esModule: true,
    default: () => React.createElement(Text, { testID: "loaded-camera-host" }, "camera"),
  };
});

import { DeferredVideoCameraCaptureHost } from "./DeferredVideoCameraCaptureHost";

describe("DeferredVideoCameraCaptureHost", () => {
  beforeEach(() => {
    mockCameraHostModuleLoaded.mockClear();
    mockScheduledTasks.length = 0;
  });

  it("keeps expo-camera work outside the first render and warms it after interactions", () => {
    render(<DeferredVideoCameraCaptureHost />);

    expect(mockCameraHostModuleLoaded).not.toHaveBeenCalled();
    expect(mockScheduledTasks).toEqual([
      expect.objectContaining({
        delayMs: 600,
      }),
    ]);

    act(() => {
      mockScheduledTasks[0]?.callback();
    });

    expect(mockCameraHostModuleLoaded).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("loaded-camera-host")).toBeOnTheScreen();
  });
});
