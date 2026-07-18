import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockNotificationsModuleLoaded = jest.fn();
const mockProfileModuleLoaded = jest.fn();
const mockSearchModuleLoaded = jest.fn();
const mockCancel = jest.fn();
const scheduledCallbacks: Array<() => void> = [];
const mockPersistLandingVisit = jest.fn(
  async (_viewerKey?: unknown, _surface?: unknown) => undefined,
);

jest.mock("../../../data/projections/warmupPreferences", () => ({
  loadPersistedWarmupPreferences: jest.fn(async () => ({
    landingAffinity: null,
    lastProfileTab: "events",
    lastSearchScope: null,
  })),
  persistWarmupLandingVisit: (viewerKey: unknown, surface: unknown) =>
    mockPersistLandingVisit(viewerKey, surface),
  rankWarmupLandingSurfaces: jest.fn(() => ["profile", "search", "notifications"]),
}));
jest.mock("../../../shared/performance/runtimePerformanceTier", () => ({
  getRuntimePerformanceTier: () => "tier1",
}));
jest.mock("../../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: (callback: () => void) => {
    scheduledCallbacks.push(callback);
    return { cancel: mockCancel };
  },
}));
jest.mock("../navigators/stacks/SearchStackNavigator", () => {
  mockSearchModuleLoaded();
  return { SearchStackNavigator: jest.fn() };
});
jest.mock("../navigators/stacks/ProfileStackNavigator", () => {
  mockProfileModuleLoaded();
  return { ProfileStackNavigator: jest.fn() };
});
jest.mock("../../../features/notifications/public/screens", () => {
  mockNotificationsModuleLoaded();
  return { NotificationsScreen: jest.fn() };
});

import { useTabLandingPrefetch } from "./useTabLandingPrefetch";

describe("useTabLandingPrefetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledCallbacks.length = 0;
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active",
    });
  });

  it("warms predicted modules one at a time away from tab presses", async () => {
    const { unmount } = renderHook(() =>
      useTabLandingPrefetch({
        activeRoute: "Profile",
        enabled: true,
        userId: "viewer-id",
        username: "alice",
      }),
    );

    await waitFor(() => {
      expect(scheduledCallbacks).toHaveLength(1);
      expect(mockPersistLandingVisit).toHaveBeenCalledWith("viewer-id", "profile");
    });

    act(() => scheduledCallbacks.shift()?.());
    expect(mockProfileModuleLoaded).toHaveBeenCalledTimes(1);
    expect(mockSearchModuleLoaded).not.toHaveBeenCalled();
    expect(scheduledCallbacks).toHaveLength(1);

    act(() => scheduledCallbacks.shift()?.());
    expect(mockSearchModuleLoaded).toHaveBeenCalledTimes(1);
    expect(mockNotificationsModuleLoaded).not.toHaveBeenCalled();
    expect(scheduledCallbacks).toHaveLength(1);

    act(() => scheduledCallbacks.shift()?.());
    expect(scheduledCallbacks).toHaveLength(0);
    await waitFor(() => {
      expect(mockProfileModuleLoaded).toHaveBeenCalledTimes(1);
      expect(mockNotificationsModuleLoaded).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(mockCancel).toHaveBeenCalled();
  });
});
