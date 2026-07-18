import React from "react";
import { act, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

let mockScheduledCallback: (() => void) | null = null;
const mockCancel = jest.fn();
const mockMediaVideoLoaded = jest.fn();

globalThis.clearImmediate = () => undefined;
globalThis.setImmediate = ((callback: () => void) => {
  callback();
  return 0;
}) as unknown as typeof setImmediate;

jest.mock("../utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: (callback: () => void) => {
    mockScheduledCallback = callback;
    return { cancel: mockCancel };
  },
}));
jest.mock("./VideoThumbnailPreview", () => {
  const ReactRuntime = require("react") as typeof React;
  const { Text: TextRuntime } = require("react-native") as typeof import("react-native");
  return {
    VideoThumbnailPreview: () =>
      ReactRuntime.createElement(TextRuntime, { testID: "video-thumbnail" }, "thumbnail"),
  };
});
jest.mock("./MediaVideo", () => {
  const ReactRuntime = require("react") as typeof React;
  const { Text: TextRuntime } = require("react-native") as typeof import("react-native");
  mockMediaVideoLoaded();
  return {
    MediaVideo: () => ReactRuntime.createElement(TextRuntime, { testID: "media-video" }, "video"),
  };
});

import { MediaViewerModal } from "./MediaViewerModal";

describe("MediaViewerModal deferred video", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduledCallback = null;
  });

  it("paints a thumbnail before evaluating the native video player", () => {
    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { height: 800, width: 400, x: 0, y: 0 },
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
        }}
      >
        <MediaViewerModal
          items={[{ kind: "video", uri: "https://cdn.example/video.mp4" }]}
          onClose={jest.fn()}
          visible
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId("video-thumbnail")).toBeTruthy();
    expect(mockMediaVideoLoaded).not.toHaveBeenCalled();
    expect(mockScheduledCallback).toBeTruthy();

    act(() => mockScheduledCallback?.());
    expect(screen.getByTestId("media-video")).toBeTruthy();
    expect(mockMediaVideoLoaded).toHaveBeenCalledTimes(1);
  });
});
