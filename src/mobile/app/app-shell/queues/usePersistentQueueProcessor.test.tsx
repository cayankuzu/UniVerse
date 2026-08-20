import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { subscribeQueueResumeSignal } from "../../data/queues/runtimeSignals";
import { logEvent } from "../../platform/observability";
import { scheduleQueueProcessorResume } from "./queueResumeScheduler";
import { usePersistentQueueProcessor } from "./usePersistentQueueProcessor";

const mockUnsubscribe = jest.fn();
const mockRemoveAppStateListener = jest.fn();
let mockAppStateListener: ((state: string) => void) | undefined;
let mockResumeSignal: (() => void) | undefined;

jest.mock("../../data/queues/runtimeSignals", () => ({
  subscribeQueueResumeSignal: jest.fn((_lane: string, listener: () => void) => {
    mockResumeSignal = listener;
    return mockUnsubscribe;
  }),
}));

jest.mock("../../platform/observability", () => ({
  logEvent: jest.fn(),
}));

jest.mock("./queueResumeScheduler", () => ({
  getStableQueueJitterMs: jest.fn(() => 0),
  scheduleQueueProcessorResume: jest.fn((task: { callback: () => void; delayMs: number }) => ({
    cancel: jest.fn(),
    ...task,
  })),
}));

const mockSubscribeQueueResumeSignal = subscribeQueueResumeSignal as jest.Mock;
const mockLogEvent = logEvent as jest.Mock;
const mockScheduleQueueProcessorResume = scheduleQueueProcessorResume as jest.Mock;

const emptyStats = { failedCount: 0, oldestPendingAgeMs: 0, pendingCount: 0 };
const pendingStats = { failedCount: 1, oldestPendingAgeMs: 2_500, pendingCount: 2 };

function latestScheduledTask() {
  const call = mockScheduleQueueProcessorResume.mock.calls.at(-1)?.[0] as
    { callback: () => void; delayMs: number } | undefined;
  if (!call) throw new Error("Expected a scheduled queue task.");
  return call;
}

function renderProcessor(params?: { ownerId?: string; readStats?: jest.Mock; resume?: jest.Mock }) {
  const readStats = params?.readStats ?? jest.fn(async () => emptyStats);
  const resume = params?.resume ?? jest.fn(async () => undefined);
  const screen = renderHook(() =>
    usePersistentQueueProcessor({
      activeDelayMs: 30,
      initialDelayMs: 10,
      jitterWindowMs: 0,
      lane: "upload",
      ownerId: params?.ownerId ?? "owner-1",
      pendingResumeDelayMs: 100,
      readStats,
      resume,
      signalDelayMs: 20,
    }),
  );
  return { ...screen, readStats, resume };
}

describe("usePersistentQueueProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    mockAppStateListener = undefined;
    mockResumeSignal = undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_event, listener) => {
      mockAppStateListener = listener as (state: string) => void;
      return { remove: mockRemoveAppStateListener };
    }) as typeof AppState.addEventListener);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("stays inert without an authenticated owner", () => {
    const { unmount } = renderProcessor({ ownerId: "" });

    expect(mockScheduleQueueProcessorResume).not.toHaveBeenCalled();
    expect(mockSubscribeQueueResumeSignal).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
    unmount();
  });

  it("resumes, reports backlog, schedules fallback, and cleans up", async () => {
    const readStats = jest
      .fn()
      .mockResolvedValueOnce(pendingStats)
      .mockResolvedValueOnce({ ...pendingStats, pendingCount: 1 })
      .mockResolvedValueOnce({ ...pendingStats, pendingCount: 1 })
      .mockResolvedValue(emptyStats);
    const resume = jest.fn(async () => undefined);
    const { unmount } = renderProcessor({ readStats, resume });

    expect(latestScheduledTask().delayMs).toBe(10);
    await act(async () => {
      latestScheduledTask().callback();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resume).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "upload-queue-backlog",
        screenKey: "authenticated-owner",
        status: "ok",
      }),
    );
    expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "rollback" }));

    act(() => {
      mockAppStateListener?.("background");
      jest.advanceTimersByTime(100);
    });
    const inactiveFallback = latestScheduledTask();
    act(() => inactiveFallback.callback());
    expect(resume).toHaveBeenCalledTimes(1);

    act(() => {
      mockAppStateListener?.("active");
      mockResumeSignal?.();
      mockResumeSignal?.();
    });
    expect(mockScheduleQueueProcessorResume).toHaveBeenCalled();

    const scheduledHandle = mockScheduleQueueProcessorResume.mock.results.at(-1)?.value as {
      cancel: jest.Mock;
    };
    unmount();
    expect(scheduledHandle.cancel).toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockRemoveAppStateListener).toHaveBeenCalled();
  });

  it("coalesces resume signals while a resume is in flight", async () => {
    let resolveResume: (() => void) | undefined;
    const resume = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve;
        }),
    );
    const readStats = jest.fn(async () => emptyStats);
    const { unmount } = renderProcessor({ readStats, resume });

    await act(async () => {
      latestScheduledTask().callback();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resume).toHaveBeenCalledTimes(1);
    const scheduleCount = mockScheduleQueueProcessorResume.mock.calls.length;

    act(() => mockResumeSignal?.());
    expect(mockScheduleQueueProcessorResume).toHaveBeenCalledTimes(scheduleCount);

    await act(async () => {
      resolveResume?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
  });
});
