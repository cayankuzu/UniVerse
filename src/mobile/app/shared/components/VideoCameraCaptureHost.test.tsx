import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";

let resolveRecording: ((value: { uri: string }) => void) | null = null;
let latestOnCameraReady: (() => void) | undefined;

const mockStopRecording = jest.fn();
const mockRecordAsync = jest.fn(
  () =>
    new Promise<{ uri: string }>((resolve) => {
      resolveRecording = resolve;
    }),
);
const mockResolveVideoCameraCapture = jest.fn();

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  })),
}));

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const MockModal = ({ children, visible }: { children: React.ReactNode; visible?: boolean }) =>
    visible ? children : null;
  return {
    __esModule: true,
    default: MockModal,
  };
});

jest.mock("react-native/Libraries/Components/StatusBar/StatusBar", () => {
  const MockStatusBar = () => null;
  return {
    __esModule: true,
    default: MockStatusBar,
  };
});

jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    CameraView: React.forwardRef(function MockCameraView(
      props: { onCameraReady?: () => void },
      ref: React.ForwardedRef<{
        recordAsync: typeof mockRecordAsync;
        stopRecording: typeof mockStopRecording;
      }>,
    ) {
      latestOnCameraReady = props.onCameraReady;
      React.useImperativeHandle(ref, () => ({
        recordAsync: mockRecordAsync,
        stopRecording: mockStopRecording,
      }));
      return <View testID="camera-view" />;
    }),
    useCameraPermissions: jest.fn(() => [
      { granted: true },
      jest.fn(async () => ({ granted: true })),
    ]),
    useMicrophonePermissions: jest.fn(() => [
      { granted: true },
      jest.fn(async () => ({ granted: true })),
    ]),
  };
});

jest.mock("../media/videoCameraCaptureController", () => ({
  resolveVideoCameraCapture: (...args: unknown[]) => mockResolveVideoCameraCapture(...args),
  useVideoCameraCaptureState: jest.fn(() => ({
    options: { maxDurationSeconds: 15 },
    requestId: 1,
    visible: true,
  })),
}));

jest.mock("./InstantPressable", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    InstantPressable: ({ children, ...props }: Record<string, unknown>) => (
      <View {...props}>{children as React.ReactNode}</View>
    ),
  };
});

describe("VideoCameraCaptureHost", () => {
  beforeEach(() => {
    latestOnCameraReady = undefined;
    resolveRecording = null;
    mockRecordAsync.mockClear();
    mockResolveVideoCameraCapture.mockClear();
    mockStopRecording.mockClear();
  });

  it("stops an active recording and resolves the captured video", async () => {
    const VideoCameraCaptureHost = require("./VideoCameraCaptureHost")
      .default as typeof import("./VideoCameraCaptureHost").default;

    render(<VideoCameraCaptureHost />);

    await waitFor(() => {
      expect(screen.getByTestId("camera-view")).toBeOnTheScreen();
    });

    await act(async () => {
      latestOnCameraReady?.();
    });

    await act(async () => {
      screen.getByTestId("video-camera-start-button").props.onPress();
    });

    await waitFor(() => {
      expect(mockRecordAsync).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      screen.getByTestId("video-camera-stop-button").props.onPress();
    });

    expect(mockStopRecording).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecording?.({ uri: "file:///capture.mp4" });
    });

    await waitFor(() => {
      expect(mockResolveVideoCameraCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: "file:///capture.mp4",
        }),
      );
    });
  }, 15_000);
});
