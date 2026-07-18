jest.mock("../performance/interactionGate", () => ({
  isInteractionActive: () => false,
  subscribeToInteractionIdle: jest.fn(),
}));

import { runLowPriorityTask } from "./lowPriorityTaskScheduler";

describe("runLowPriorityTask", () => {
  it("runs background work in FIFO order with one active task", async () => {
    const events: string[] = [];
    let finishFirst = () => undefined;
    let finishSecond = () => undefined;

    const first = runLowPriorityTask(
      () =>
        new Promise<void>((resolve) => {
          events.push("first:start");
          finishFirst = () => {
            events.push("first:end");
            resolve();
          };
        }),
    );
    const second = runLowPriorityTask(
      () =>
        new Promise<void>((resolve) => {
          events.push("second:start");
          finishSecond = () => {
            events.push("second:end");
            resolve();
          };
        }),
    );

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    finishFirst();
    await first;
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["first:start", "first:end", "second:start"]);

    finishSecond();
    await second;
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
