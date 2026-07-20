jest.mock("../auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("./AppStartupState", () => ({
  useAppStartupState: jest.fn(),
}));

jest.mock("../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn(() => ({
    cancel: jest.fn(),
  })),
}));

jest.mock("../bridges/AppPushNotificationsBridge", () => ({
  AppPushNotificationsBridge: () => null,
}));

jest.mock("../bridges/ProjectionRealtimeBridge", () => ({
  ProjectionRealtimeBridge: () => null,
}));

jest.mock("../queues/AppMutationQueueProcessor", () => ({
  AppMutationQueueProcessor: () => null,
}));

jest.mock("../queues/AppUploadQueueProcessor", () => ({
  AppUploadQueueProcessor: () => null,
}));

jest.mock("./AppDataWarmup", () => ({
  AppDataWarmup: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, { testID: "app-data-warmup" }, "warmup");
  },
}));

import React from "react";
import { act, render } from "@testing-library/react-native";
import { useAuth } from "../auth";
import { useAppStartupState } from "./AppStartupState";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";
import { DeferredAppServices } from "./DeferredAppServices";

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const useAppStartupStateMock = useAppStartupState as jest.MockedFunction<typeof useAppStartupState>;
const scheduleAfterInteractionsMock = scheduleAfterInteractions as jest.MockedFunction<
  typeof scheduleAfterInteractions
>;
const scheduledCallbacks: Array<() => void> = [];

describe("DeferredAppServices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledCallbacks.length = 0;
    scheduleAfterInteractionsMock.mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return { cancel: jest.fn() };
    });
    useAppStartupStateMock.mockReturnValue({
      queryCacheReady: true,
      queryRestoreReady: true,
    });
  });

  it("does not schedule deferred services before login", () => {
    useAuthMock.mockReturnValue({
      accountType: "student",
      authBootState: "signed_out",
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: false,
      userData: { id: null },
    } as unknown as ReturnType<typeof useAuth>);

    const { queryByTestId } = render(<DeferredAppServices />);

    expect(scheduleAfterInteractionsMock).not.toHaveBeenCalled();
    expect(queryByTestId("app-data-warmup")).toBeNull();
  });

  it("skips the warmup stage for demo accounts", () => {
    useAuthMock.mockReturnValue({
      accountType: "student",
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isDemoMode: true,
      isLoggedIn: true,
      userData: { id: "viewer-1" },
    } as unknown as ReturnType<typeof useAuth>);

    const { queryByTestId } = render(<DeferredAppServices />);

    expect(scheduleAfterInteractionsMock.mock.calls.map(([, delayMs]) => delayMs)).toEqual([100]);
    expect(queryByTestId("app-data-warmup")).toBeNull();
  });

  it("starts warmup immediately and keeps the remaining services deferred", () => {
    useAuthMock.mockReturnValue({
      accountType: "student",
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: true,
      userData: { id: "viewer-1" },
    } as unknown as ReturnType<typeof useAuth>);

    const { getByTestId } = render(<DeferredAppServices />);

    expect(scheduleAfterInteractionsMock.mock.calls.map(([, delayMs]) => delayMs)).toEqual([100]);
    expect(getByTestId("app-data-warmup")).toBeTruthy();
  });

  it("activates authenticated services in one sequential lane", () => {
    useAuthMock.mockReturnValue({
      accountType: "student",
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: true,
      userData: { id: "viewer-1" },
    } as unknown as ReturnType<typeof useAuth>);

    render(<DeferredAppServices />);

    for (let index = 0; index < 4; index += 1) {
      expect(scheduledCallbacks).toHaveLength(1);
      act(() => {
        scheduledCallbacks.shift()?.();
      });
    }

    expect(scheduleAfterInteractionsMock.mock.calls.map(([, delayMs]) => delayMs)).toEqual([
      100, 80, 160, 480,
    ]);
    expect(scheduledCallbacks).toHaveLength(0);
  });

  it("waits for query restore before mounting warmup", () => {
    useAppStartupStateMock.mockReturnValue({
      queryCacheReady: true,
      queryRestoreReady: false,
    });
    useAuthMock.mockReturnValue({
      accountType: "student",
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: true,
      userData: { id: "viewer-1" },
    } as unknown as ReturnType<typeof useAuth>);

    const { queryByTestId } = render(<DeferredAppServices />);

    expect(queryByTestId("app-data-warmup")).toBeNull();
  });
});
