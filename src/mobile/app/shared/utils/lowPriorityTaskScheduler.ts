import { isInteractionActive, subscribeToInteractionIdle } from "../performance/interactionGate";

const MAX_LOW_PRIORITY_CONCURRENCY = 1;

type TaskRunner<T> = () => Promise<T> | T;

const queuedTasks: Array<() => void> = [];
const inflightTasks = new Map<string, Promise<unknown>>();
let activeTaskCount = 0;

function normalizeKey(value?: string | null) {
  return String(value || "").trim();
}

function drainLowPriorityQueue() {
  if (isInteractionActive()) return;
  while (activeTaskCount < MAX_LOW_PRIORITY_CONCURRENCY && queuedTasks.length > 0) {
    const next = queuedTasks.shift();
    next?.();
  }
}

subscribeToInteractionIdle(() => {
  drainLowPriorityQueue();
});

export function runLowPriorityTask<T>(task: TaskRunner<T>, options?: { key?: string | null }) {
  const normalizedKey = normalizeKey(options?.key);
  if (normalizedKey) {
    const inflight = inflightTasks.get(normalizedKey);
    if (inflight) return inflight as Promise<T>;
  }

  const scheduledPromise = new Promise<T>((resolve, reject) => {
    const startTask = () => {
      activeTaskCount += 1;
      void Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          activeTaskCount = Math.max(0, activeTaskCount - 1);
          if (normalizedKey && inflightTasks.get(normalizedKey) === scheduledPromise) {
            inflightTasks.delete(normalizedKey);
          }
          drainLowPriorityQueue();
        });
    };

    queuedTasks.push(startTask);
    drainLowPriorityQueue();
  });

  if (normalizedKey) {
    inflightTasks.set(normalizedKey, scheduledPromise as Promise<unknown>);
  }
  return scheduledPromise;
}
