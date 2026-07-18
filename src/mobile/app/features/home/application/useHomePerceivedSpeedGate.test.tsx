import { act, renderHook } from "@testing-library/react-native";
import { useHomePerceivedSpeedGate } from "./useHomePerceivedSpeedGate";

const mockSubscribeToInteractionIdle = jest.fn();
let idleListener: (() => void) | null = null;

jest.mock("../../../shared/performance/interactionGate", () => ({
  subscribeToInteractionIdle: (...args: unknown[]) => mockSubscribeToInteractionIdle(...args),
}));

jest.mock("../../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: (callback: () => void, delayMs = 0) => {
    const timer = setTimeout(callback, delayMs);
    return {
      cancel: () => clearTimeout(timer),
    };
  },
}));

describe("useHomePerceivedSpeedGate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    idleListener = null;
    mockSubscribeToInteractionIdle.mockReset();
    mockSubscribeToInteractionIdle.mockImplementation((listener: () => void) => {
      idleListener = listener;
      return () => {
        if (idleListener === listener) {
          idleListener = null;
        }
      };
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("unlocks secondary reads, media upgrade, and prefetch in staged order without interaction", () => {
    const { result } = renderHook(() =>
      useHomePerceivedSpeedGate({
        hasImmediateContent: true,
        hasUserInteracted: false,
        scopeKey: "viewer:all",
      }),
    );

    expect(result.current.allowImmediateContent).toBe(true);
    expect(result.current.allowSecondaryReads).toBe(false);

    act(() => {
      jest.advanceTimersByTime(80);
    });
    expect(result.current.allowSecondaryReads).toBe(true);
    expect(result.current.allowMediaUpgrade).toBe(false);

    act(() => {
      jest.advanceTimersByTime(24);
    });
    expect(result.current.allowMediaUpgrade).toBe(true);
    expect(result.current.allowPrefetch).toBe(false);

    act(() => {
      jest.advanceTimersByTime(40);
    });
    expect(result.current.allowPrefetch).toBe(true);
  });

  it("keeps secondary reads blocked until interaction settles", () => {
    const { result } = renderHook(() =>
      useHomePerceivedSpeedGate({
        hasImmediateContent: true,
        hasUserInteracted: true,
        scopeKey: "viewer:all",
      }),
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.allowSecondaryReads).toBe(false);

    act(() => {
      idleListener?.();
      jest.advanceTimersByTime(47);
    });
    expect(result.current.allowSecondaryReads).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.allowSecondaryReads).toBe(true);
  });
});
