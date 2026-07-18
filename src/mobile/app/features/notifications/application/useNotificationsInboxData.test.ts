import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

let mockFocused = true;
const mockBackgroundRefresh = jest.fn(async () => undefined);
const mockProjection = {
  hasCachedSnapshot: true,
  hasMore: false,
  items: [],
  loadMore: jest.fn(),
  loadingMore: false,
  onBackgroundRefresh: mockBackgroundRefresh,
  onRefresh: jest.fn(async () => undefined),
  query: { data: null },
  refreshing: false,
  shouldShowInitialSkeleton: false,
};

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: () => mockProjection,
}));
jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: () => jest.fn(async () => undefined),
}));

import { shouldPollNotifications, useNotificationsInboxData } from "./useNotificationsInboxData";

describe("notification polling budget", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocused = true;
    mockBackgroundRefresh.mockClear();
    mockProjection.hasCachedSnapshot = true;
    (AppState as unknown as { currentState: string }).currentState = "active";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("runs only for a focused, active, cached, idle inbox", () => {
    expect(
      shouldPollNotifications({
        appState: "active",
        hasCachedSnapshot: true,
        inFlight: false,
        isFocused: true,
      }),
    ).toBe(true);
    expect(
      shouldPollNotifications({
        appState: "background",
        hasCachedSnapshot: true,
        inFlight: false,
        isFocused: true,
      }),
    ).toBe(false);
    expect(
      shouldPollNotifications({
        appState: "active",
        hasCachedSnapshot: true,
        inFlight: true,
        isFocused: true,
      }),
    ).toBe(false);
  });

  it("refreshes a focused cached inbox without blocking its cached render", async () => {
    const { result } = renderHook(() =>
      useNotificationsInboxData({
        activeFilter: "all",
        blockedUsers: [],
        viewer: { id: "viewer-id", username: "alice" },
      }),
    );

    expect(result.current.listItems).toEqual([]);
    expect(result.current.notificationsProjectionItemCount).toBe(0);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(12_000);
    });
    expect(mockBackgroundRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not mount fallback polling while the inbox is unfocused", async () => {
    mockFocused = false;
    renderHook(() =>
      useNotificationsInboxData({
        activeFilter: "all",
        blockedUsers: ["blocked-user"],
        viewer: { username: "alice" },
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(24_000);
    });
    expect(mockBackgroundRefresh).not.toHaveBeenCalled();
  });
});
