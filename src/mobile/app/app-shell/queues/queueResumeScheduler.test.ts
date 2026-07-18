import {
  getStableQueueJitterMs,
  runQueueProcessorsWithPacing,
  scheduleQueueProcessorResume,
} from "./queueResumeScheduler";

jest.mock("../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn((callback: () => void) => {
    callback();
    return { cancel: jest.fn() };
  }),
}));

describe("queueResumeScheduler", () => {
  it("returns deterministic jitter within the configured bound", () => {
    const first = getStableQueueJitterMs("viewer-1:mutation", 320);
    const second = getStableQueueJitterMs("viewer-1:mutation", 320);
    const third = getStableQueueJitterMs("viewer-2:mutation", 320);

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(320);
    expect(third).toBeGreaterThanOrEqual(0);
    expect(third).toBeLessThanOrEqual(320);
  });

  it("runs processors sequentially and continues after a failure", async () => {
    const calls: string[] = [];

    await runQueueProcessorsWithPacing({
      baseDelayMs: 0,
      context: { ownerId: "viewer-1" },
      jitterMs: 0,
      lane: "mutation",
      ownerId: "viewer-1",
      processors: [
        {
          id: "first",
          process: async () => {
            calls.push("first");
          },
        },
        {
          id: "second",
          process: async () => {
            calls.push("second");
            throw new Error("boom");
          },
        },
        {
          id: "third",
          process: async () => {
            calls.push("third");
          },
        },
      ],
    });

    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("schedules queue resumes through the interaction-aware scheduler", () => {
    const callback = jest.fn();

    const task = scheduleQueueProcessorResume({
      callback,
      delayMs: 120,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(task).toMatchObject({
      cancel: expect.any(Function),
    });
  });
});
