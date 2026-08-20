import { renderHook } from "@testing-library/react-native";

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

jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: () => mockProjection,
}));
jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: () => jest.fn(async () => undefined),
}));

import { useNotificationsInboxData } from "./useNotificationsInboxData";

describe("notification inbox data", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBackgroundRefresh.mockClear();
    mockProjection.hasCachedSnapshot = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders cached content without mounting a periodic fallback poll", () => {
    const { result } = renderHook(() =>
      useNotificationsInboxData({
        activeFilter: "all",
        blockedUsers: [],
        viewer: { id: "viewer-id", username: "alice" },
      }),
    );

    expect(result.current.listItems).toEqual([]);
    expect(result.current.notificationsProjectionItemCount).toBe(0);
    jest.advanceTimersByTime(24_000);
    expect(mockBackgroundRefresh).not.toHaveBeenCalled();
  });
});
