type InteractionListener = () => void;

const DEFAULT_INTERACTION_HOLD_MS = 180;
const DEFAULT_INTERACTION_RELEASE_MS = 120;

let activeScopeCount = 0;
let interactionUntilMs = 0;
let interactionListenerId = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<number, InteractionListener>();

function clearIdleTimer() {
  if (!idleTimer) return;
  clearTimeout(idleTimer);
  idleTimer = null;
}

function notifyIdleListeners() {
  if (isInteractionActive()) {
    scheduleInteractionIdleNotification();
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      return;
    }
  });
}

function scheduleInteractionIdleNotification() {
  clearIdleTimer();
  const remainingMs = getInteractionRemainingMs();
  idleTimer = setTimeout(notifyIdleListeners, Math.max(16, remainingMs));
}

function extendInteractionWindow(holdMs: number) {
  interactionUntilMs = Math.max(interactionUntilMs, Date.now() + Math.max(0, holdMs));
  scheduleInteractionIdleNotification();
}

export function isInteractionActive(nowMs = Date.now()) {
  return activeScopeCount > 0 || interactionUntilMs > nowMs;
}

export function getInteractionRemainingMs(nowMs = Date.now()) {
  if (activeScopeCount > 0) {
    return Math.max(DEFAULT_INTERACTION_HOLD_MS, interactionUntilMs - nowMs);
  }
  return Math.max(0, interactionUntilMs - nowMs);
}

export function noteInteractionActive(holdMs = DEFAULT_INTERACTION_HOLD_MS) {
  extendInteractionWindow(holdMs);
}

export function beginInteractionScope(options?: { holdMs?: number; releaseMs?: number }) {
  const releaseMs = Math.max(0, options?.releaseMs ?? DEFAULT_INTERACTION_RELEASE_MS);
  activeScopeCount += 1;
  extendInteractionWindow(options?.holdMs ?? DEFAULT_INTERACTION_HOLD_MS);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeScopeCount = Math.max(0, activeScopeCount - 1);
    extendInteractionWindow(releaseMs);
  };
}

export function subscribeToInteractionIdle(listener: InteractionListener) {
  interactionListenerId += 1;
  const id = interactionListenerId;
  listeners.set(id, listener);
  if (!isInteractionActive()) {
    queueMicrotask(() => {
      if (!listeners.has(id) || isInteractionActive()) return;
      listener();
    });
  }
  return () => {
    listeners.delete(id);
  };
}

export function resetInteractionGate() {
  activeScopeCount = 0;
  interactionUntilMs = 0;
  clearIdleTimer();
  listeners.clear();
}
