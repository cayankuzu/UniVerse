import { getInteractionRemainingMs } from "../performance/interactionGate";

type CancelableTask = {
  cancel: () => void;
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type GlobalIdleScheduler = typeof globalThis & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number },
  ) => number;
};

const DEFAULT_DELAY_MS = 24;

export function scheduleAfterInteractions(
  callback: () => void,
  delayMs = DEFAULT_DELAY_MS,
): CancelableTask {
  let cancelled = false;
  let idleId = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;
  const idleScheduler = globalThis as GlobalIdleScheduler;

  const run = () => {
    if (cancelled) return;
    const remainingInteractionMs = getInteractionRemainingMs();
    if (remainingInteractionMs > 0) {
      timeoutId = setTimeout(run, remainingInteractionMs);
      return;
    }
    callback();
  };

  const scheduleTimeout = () => {
    if (cancelled) return;
    const deferredDelayMs = Math.max(0, delayMs) + getInteractionRemainingMs();
    if (deferredDelayMs <= 0) {
      run();
      return;
    }
    timeoutId = setTimeout(run, deferredDelayMs);
  };

  const scheduleFrame = () => {
    if (cancelled) return;
    if (delayMs <= 0 && getInteractionRemainingMs() <= 0) {
      run();
      return;
    }
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(scheduleTimeout);
      return;
    }
    scheduleTimeout();
  };

  if (typeof idleScheduler.requestIdleCallback === "function") {
    idleId = idleScheduler.requestIdleCallback(
      () => {
        scheduleFrame();
      },
      { timeout: Math.max(delayMs, 64) },
    );
  } else {
    scheduleFrame();
  }

  return {
    cancel: () => {
      cancelled = true;
      if (idleId) idleScheduler.cancelIdleCallback?.(idleId);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}
