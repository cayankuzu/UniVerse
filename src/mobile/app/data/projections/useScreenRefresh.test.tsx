import { act, renderHook } from "@testing-library/react-native";
import { logScreenView } from "../../platform/observability";
import { useScreenRefresh } from "./screen/useScreenRefresh";

jest.mock("../../platform/observability", () => ({
  logScreenView: jest.fn(),
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn((callback: () => void) => {
    queueMicrotask(callback);
    return { cancel: jest.fn() };
  }),
}));

const { startObservedTimer: mockStartObservedTimer } = jest.requireMock(
  "../../platform/observability",
) as {
  startObservedTimer: jest.Mock;
};

describe("useScreenRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves after critical lane and lets background work continue silently", async () => {
    let resolveCritical: (() => void) | null = null;
    let resolveBackground: (() => void) | null = null;
    let backgroundCompleted = false;

    const { result } = renderHook(() =>
      useScreenRefresh({
        maxParallel: 1,
        screenKey: "home:viewer",
        tasks: [
          {
            id: "critical-feed",
            run: () =>
              new Promise<void>((resolve) => {
                resolveCritical = resolve;
              }),
          },
          {
            id: "background-badge",
            lane: "background",
            run: () =>
              new Promise<void>((resolve) => {
                resolveBackground = () => {
                  backgroundCompleted = true;
                  resolve();
                };
              }),
          },
        ],
      }),
    );

    const refreshPromise = result.current();

    expect(backgroundCompleted).toBe(false);
    expect(mockStartObservedTimer).toHaveBeenCalledTimes(1);
    expect(mockStartObservedTimer).toHaveBeenCalledWith({
      category: "screen",
      meta: {
        backgroundTaskCount: 1,
        taskCount: 1,
      },
      name: "home:viewer:refresh",
      screenKey: "home:viewer",
    });

    await act(async () => {
      resolveCritical?.();
      await refreshPromise;
      await Promise.resolve();
    });

    expect(backgroundCompleted).toBe(false);
    expect(mockStartObservedTimer).toHaveBeenCalledTimes(2);
    expect(mockStartObservedTimer).toHaveBeenCalledWith({
      category: "screen",
      meta: {
        delayMs: 120,
        lane: "background",
        taskCount: 1,
      },
      name: "home:viewer:refresh:background",
      screenKey: "home:viewer",
    });
    expect(logScreenView).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          backgroundTaskCount: 1,
          taskCount: 1,
        }),
        name: "manual_refresh_latency",
        screenKey: "home:viewer",
      }),
    );

    await act(async () => {
      resolveBackground?.();
      await Promise.resolve();
    });

    expect(backgroundCompleted).toBe(true);
  });

  it("rejects when a critical non-best-effort task fails", async () => {
    const error = new Error("critical failed");
    const { result } = renderHook(() =>
      useScreenRefresh({
        screenKey: "profile:viewer",
        tasks: [
          {
            id: "critical-profile",
            run: async () => {
              throw error;
            },
          },
          {
            id: "background-fallback",
            lane: "background",
            run: jest.fn(),
          },
        ],
      }),
    );

    await expect(result.current()).rejects.toThrow("critical failed");
  });

  it("coalesces repeated refresh calls while a refresh is already in flight", async () => {
    let resolveCritical: (() => void) | null = null;
    const criticalTask = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCritical = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useScreenRefresh({
        screenKey: "notifications:viewer",
        tasks: [
          {
            id: "critical-notifications",
            run: criticalTask,
          },
        ],
      }),
    );

    const firstRefresh = result.current();
    const secondRefresh = result.current();

    expect(firstRefresh).toBe(secondRefresh);
    expect(criticalTask).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCritical?.();
      await firstRefresh;
    });
  });
});
