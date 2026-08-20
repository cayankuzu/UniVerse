import { act, renderHook } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import { NotificationPushAPI } from "../../features/notifications/public/push";
import { subscribeNotificationPermissionGranted } from "../../platform/notifications/notificationPermission";
import { hasNotificationPermission, resolveExpoProjectId } from "./pushRegistration.shared";
import { usePushRegistrationSync } from "./usePushRegistrationSync";

const mockUnsubscribePermission = jest.fn();
const mockRemoveAppStateListener = jest.fn();
const mockRemovePushTokenListener = jest.fn();
let mockPermissionListener: (() => void) | undefined;
let mockAppStateListener: ((state: string) => void) | undefined;
let mockPushTokenListener: (() => void) | undefined;

jest.mock("expo-notifications", () => ({
  addPushTokenListener: jest.fn((listener: () => void) => {
    mockPushTokenListener = listener;
    return { remove: mockRemovePushTokenListener };
  }),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[token]" })),
  getPermissionsAsync: jest.fn(),
}));
jest.mock("../../platform/config/runtime", () => ({ APP_ENV: "production" }));
jest.mock("../auth", () => ({
  useAuth: () => ({ isLoggedIn: true, userData: { id: "user-1" } }),
}));
jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));
jest.mock("../../platform/api/core", () => ({
  isHttpRequestError: jest.fn(() => false),
}));
jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      getUser: jest.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
      refreshSession: jest.fn(async () => ({ error: null })),
    },
  },
}));
jest.mock("../../features/notifications/public/push", () => ({
  NotificationPushAPI: {
    clearStoredRegistration: jest.fn(async () => undefined),
    getStoredRegistration: jest.fn(),
    registerToken: jest.fn(async () => undefined),
    rememberRegistration: jest.fn(async () => undefined),
    unregisterToken: jest.fn(async () => undefined),
  },
}));
jest.mock("../../platform/notifications/notificationPermission", () => ({
  subscribeNotificationPermissionGranted: jest.fn((listener: () => void) => {
    mockPermissionListener = listener;
    return mockUnsubscribePermission;
  }),
}));
jest.mock("../queues/queueResumeScheduler", () => ({
  getStableQueueJitterMs: jest.fn(() => 0),
}));
jest.mock("./pushRegistration.shared", () => ({
  ACTIVE_PUSH_SYNC_DELAY_MS: 5,
  ensureAndroidNotificationChannel: jest.fn(async () => undefined),
  hasNotificationPermission: jest.fn(),
  INITIAL_BACKOFF_MS: 20,
  INITIAL_PUSH_SYNC_DELAY_MS: 10,
  MAX_PUSH_SYNC_RETRIES: 2,
  MIN_PUSH_SYNC_INTERVAL_MS: 30_000,
  PUSH_AUTH_REJECT_COOLDOWN_MS: 60_000,
  PUSH_SYNC_FRESH_MS: 60_000,
  PUSH_SYNC_JITTER_WINDOW_MS: 0,
  resolveExpoProjectId: jest.fn(() => "project-id"),
  resolvePushPlatform: jest.fn(() => "android"),
  shouldSkipPushRegistration: jest.fn(() => false),
}));

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockHasNotificationPermission = hasNotificationPermission as jest.Mock;
const mockResolveExpoProjectId = resolveExpoProjectId as jest.Mock;
const mockSubscribeNotificationPermissionGranted =
  subscribeNotificationPermissionGranted as jest.Mock;
const mockGetStoredRegistration = NotificationPushAPI.getStoredRegistration as jest.Mock;
const mockUnregisterToken = NotificationPushAPI.unregisterToken as jest.Mock;
const mockClearStoredRegistration = NotificationPushAPI.clearStoredRegistration as jest.Mock;

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("usePushRegistrationSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    mockPermissionListener = undefined;
    mockAppStateListener = undefined;
    mockPushTokenListener = undefined;
    mockHasNotificationPermission.mockReturnValue(false);
    mockResolveExpoProjectId.mockReturnValue("project-id");
    mockGetStoredRegistration.mockResolvedValue(null);
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_event, listener) => {
      mockAppStateListener = listener as (state: string) => void;
      return { remove: mockRemoveAppStateListener };
    }) as typeof AppState.addEventListener);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("clears a stored token when permission is missing and responds to permission signals", async () => {
    mockGetStoredRegistration.mockResolvedValue({
      expoPushToken: "ExponentPushToken[old]",
      userId: "user-1",
    });
    const { unmount } = renderHook(() => usePushRegistrationSync());

    await act(async () => {
      jest.advanceTimersByTime(10);
      await flushAsyncWork();
    });
    expect(mockUnregisterToken).toHaveBeenCalledWith("ExponentPushToken[old]");
    expect(mockClearStoredRegistration).toHaveBeenCalled();

    await act(async () => {
      mockPermissionListener?.();
      jest.advanceTimersByTime(0);
      await flushAsyncWork();
    });
    await act(async () => {
      mockAppStateListener?.("active");
      jest.advanceTimersByTime(5);
      await flushAsyncWork();
    });

    expect(mockSubscribeNotificationPermissionGranted).toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribePermission).toHaveBeenCalled();
    expect(mockRemovePushTokenListener).toHaveBeenCalled();
    expect(mockRemoveAppStateListener).toHaveBeenCalled();
  });

  it("stops retrying when a retry observes a missing permission", async () => {
    mockHasNotificationPermission.mockReturnValueOnce(true).mockReturnValue(false);
    mockResolveExpoProjectId.mockReturnValue("");
    const { unmount } = renderHook(() => usePushRegistrationSync());

    await act(async () => {
      jest.advanceTimersByTime(10);
      await flushAsyncWork();
    });
    await act(async () => {
      jest.advanceTimersByTime(20);
      await flushAsyncWork();
    });

    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("refreshes registration immediately when the native push token rotates", async () => {
    mockHasNotificationPermission.mockReturnValue(true);
    const { unmount } = renderHook(() => usePushRegistrationSync());

    await act(async () => {
      jest.advanceTimersByTime(10);
      await flushAsyncWork();
    });
    expect(NotificationPushAPI.registerToken).toHaveBeenCalledWith(
      expect.objectContaining({ expoProjectId: "project-id" }),
    );

    jest.setSystemTime(new Date("2026-08-19T12:00:01.000Z"));
    await act(async () => {
      mockPushTokenListener?.();
      jest.advanceTimersByTime(0);
      await flushAsyncWork();
    });

    expect(NotificationPushAPI.registerToken).toHaveBeenCalledTimes(2);
    unmount();
  });
});
