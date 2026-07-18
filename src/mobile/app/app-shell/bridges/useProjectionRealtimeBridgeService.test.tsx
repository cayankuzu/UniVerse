import { act, renderHook } from "@testing-library/react-native";

const mockChannel = { subscribe: jest.fn(async () => undefined) };
const mockRemoveChannel = jest.fn(async (_channel?: unknown) => undefined);
const mockUnsubscribeStore = jest.fn();
const mockSubscribeStore = jest.fn((_listener?: unknown) => mockUnsubscribeStore);
let mockRealtimeDispatch: ((event: Record<string, unknown>) => void) | null = null;

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("../auth", () => ({
  useAuth: () => ({
    isDemoMode: false,
    isLoggedIn: true,
    userData: { id: "viewer-id", username: "Alice" },
  }),
}));
jest.mock("../../platform/supabase", () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: (channel: unknown) => mockRemoveChannel(channel),
  },
}));
jest.mock("../../data/projections/sync/syncOrchestrator", () => ({
  scheduleProjectionSyncByEntity: jest.fn(),
  useSyncOrchestratorStore: {
    subscribe: (listener: unknown) => mockSubscribeStore(listener),
  },
}));
jest.mock("../../data/projections/projectionRealtime", () => ({
  applyProjectionRealtimeEvent: jest.fn(),
}));
jest.mock("../../platform/observability", () => ({ logProjectionMetric: jest.fn() }));
jest.mock("./projectionRealtimeSubscriptions", () => ({
  bindContentRealtime: (_channel: unknown, params: { dispatch: typeof mockRealtimeDispatch }) => {
    mockRealtimeDispatch = params.dispatch;
  },
  bindNotificationRealtime: jest.fn(),
  bindSocialRealtime: jest.fn(),
}));
jest.mock("./projectionRealtimeScope", () => ({
  collectContentRealtimeScope: () => ({ eventIds: [], photoIds: [] }),
  normalizeRealtimeValue: (value: unknown) =>
    String(value || "")
      .trim()
      .toLowerCase(),
  serializeContentRealtimeScope: () => "empty",
}));
jest.mock("./notificationPresenceSync", () => ({
  hydrateNotificationPresence: jest.fn(async () => ({
    hydratedBadge: false,
    hydratedNotifications: false,
  })),
}));

import { useProjectionRealtimeBridgeService } from "./useProjectionRealtimeBridgeService";

describe("useProjectionRealtimeBridgeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealtimeDispatch = null;
  });

  it("clears every pending realtime set and subscription on unmount", () => {
    const { unmount } = renderHook(() => useProjectionRealtimeBridgeService());

    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribeStore).toHaveBeenCalledTimes(1);
    unmount();

    expect(mockUnsubscribeStore).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("flushes and clears all content and social realtime identity sets", () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() => useProjectionRealtimeBridgeService());
    expect(mockRealtimeDispatch).toBeTruthy();

    act(() => {
      mockRealtimeDispatch?.({
        eventIds: ["event-1"],
        kind: "content-engagement-changed",
        photoIds: ["photo-1"],
      });
      mockRealtimeDispatch?.({
        kind: "profile-social-changed",
        targetProfileIds: ["profile-1"],
        targetUsernames: ["Bob"],
        viewerUsername: "Alice",
      });
      jest.advanceTimersByTime(32);
    });

    unmount();
    jest.useRealTimers();
  });
});
