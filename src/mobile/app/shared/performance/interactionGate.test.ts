import {
  beginInteractionScope,
  getInteractionRemainingMs,
  isInteractionActive,
  noteInteractionActive,
  resetInteractionGate,
  subscribeToInteractionIdle,
} from "./interactionGate";

describe("interactionGate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetInteractionGate();
  });

  afterEach(() => {
    resetInteractionGate();
    jest.useRealTimers();
  });

  it("keeps the app in an interactive window after a tap pulse", () => {
    expect(isInteractionActive()).toBe(false);

    noteInteractionActive(200);

    expect(isInteractionActive()).toBe(true);
    expect(getInteractionRemainingMs()).toBeGreaterThan(0);

    jest.advanceTimersByTime(220);

    expect(isInteractionActive()).toBe(false);
  });

  it("holds interaction active for the lifetime of a scoped gesture", () => {
    const endInteraction = beginInteractionScope({
      holdMs: 120,
      releaseMs: 80,
    });

    expect(isInteractionActive()).toBe(true);

    jest.advanceTimersByTime(300);
    expect(isInteractionActive()).toBe(true);

    endInteraction();
    expect(isInteractionActive()).toBe(true);

    jest.advanceTimersByTime(120);
    expect(isInteractionActive()).toBe(false);
  });

  it("notifies idle listeners once the interaction window closes", () => {
    const idleListener = jest.fn();
    const unsubscribe = subscribeToInteractionIdle(idleListener);

    noteInteractionActive(180);
    jest.advanceTimersByTime(120);
    expect(idleListener).not.toHaveBeenCalled();

    jest.advanceTimersByTime(120);
    expect(idleListener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
