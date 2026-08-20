import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useScreenSync } from "./sync/useScreenSync";

type AppStateChangeHandler = (nextAppState: string) => void;

let mockIsFocused = false;
let appStateChangeHandler: AppStateChangeHandler | null = null;

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useIsFocused: () => mockIsFocused,
}));

describe("useScreenSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    mockIsFocused = false;
    appStateChangeHandler = null;
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active",
    });
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      _,
      listener: AppStateChangeHandler,
    ) => {
      appStateChangeHandler = listener;
      return {
        remove: jest.fn(() => {
          appStateChangeHandler = null;
        }),
      };
    }) as typeof AppState.addEventListener);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("forces manual refresh even when cached content is still fresh", async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const seededSyncedAt = Date.now();
    const { result } = renderHook(() =>
      useScreenSync({
        initialLastSyncedAt: seededSyncedAt,
        manualSkipIfFreshMs: 0,
        refresh,
        screenKey: "home",
        skipIfFreshMs: 5_000,
      }),
    );

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.lastSyncedAt).toBeGreaterThanOrEqual(seededSyncedAt);
    expect(result.current.refreshing).toBe(false);
  });

  it("skips only background refresh when cached content is still fresh", async () => {
    const backgroundRefresh = jest.fn().mockResolvedValue(undefined);
    const seededSyncedAt = Date.now();
    const { result } = renderHook(() =>
      useScreenSync({
        backgroundRefresh,
        initialLastSyncedAt: seededSyncedAt,
        screenKey: "home",
        skipIfFreshMs: 5_000,
      }),
    );

    await act(async () => {
      await result.current.onBackgroundRefresh();
    });

    expect(backgroundRefresh).not.toHaveBeenCalled();
    expect(result.current.lastSyncedAt).toBe(seededSyncedAt);
    expect(result.current.backgroundRefreshing).toBe(false);
  });

  it("runs silent refresh work through the background channel", async () => {
    let resolveBackgroundTask: (() => void) | null = null;
    const backgroundRefresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveBackgroundTask = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useScreenSync({
        backgroundRefresh,
        screenKey: "home",
      }),
    );

    act(() => {
      void result.current.onBackgroundRefresh();
    });

    expect(backgroundRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.backgroundRefreshing).toBe(true);
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      resolveBackgroundTask?.();
      await Promise.resolve();
    });

    expect(result.current.backgroundRefreshing).toBe(false);
    expect(result.current.lastSyncedAt).toBeGreaterThan(0);
  });

  it("joins an in-flight sync instead of starting duplicate refresh work", async () => {
    let resolveRefresh: (() => void) | null = null;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useScreenSync({
        refresh,
        screenKey: "home",
      }),
    );

    act(() => {
      void result.current.onBackgroundRefresh();
    });
    act(() => {
      void result.current.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.backgroundRefreshing).toBe(true);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      resolveRefresh?.();
      await Promise.resolve();
    });

    expect(result.current.backgroundRefreshing).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it("releases the manual spinner early when joining an in-flight sync", async () => {
    let resolveRefresh: (() => void) | null = null;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useScreenSync({
        manualPendingMaxMs: 120,
        refresh,
        screenKey: "home",
      }),
    );

    act(() => {
      void result.current.onBackgroundRefresh();
    });
    act(() => {
      void result.current.onRefresh();
    });

    expect(result.current.backgroundRefreshing).toBe(true);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(121);
      await Promise.resolve();
    });

    expect(result.current.backgroundRefreshing).toBe(true);
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      resolveRefresh?.();
      await Promise.resolve();
    });

    expect(result.current.backgroundRefreshing).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it("releases manual refresh spinner early while the sync keeps running", async () => {
    let resolveRefresh: (() => void) | null = null;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useScreenSync({
        manualPendingMaxMs: 480,
        refresh,
        screenKey: "home",
      }),
    );

    act(() => {
      void result.current.onRefresh();
    });

    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(481);
      await Promise.resolve();
    });

    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      resolveRefresh?.();
      await Promise.resolve();
    });

    expect(result.current.lastSyncedAt).toBeGreaterThan(0);
  });

  it("refreshes focused screens when the app returns to the foreground", async () => {
    mockIsFocused = true;
    const backgroundRefresh = jest.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useScreenSync({
        autoRefreshOnFocus: true,
        backgroundRefresh,
        focusThrottleMs: 0,
        screenKey: "home",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    backgroundRefresh.mockClear();

    await act(async () => {
      appStateChangeHandler?.("background");
      appStateChangeHandler?.("active");
      await Promise.resolve();
    });

    expect(backgroundRefresh).toHaveBeenCalledTimes(1);
  });
});
