import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";

interface QueueProcessorLike<TContext> {
  id: string;
  process: (context: TContext) => Promise<void> | void;
}

type CancelableTask = {
  cancel: () => void;
};

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function waitForScheduledResume(delayMs: number) {
  return new Promise<void>((resolve) => {
    const task = scheduleQueueProcessorResume({
      callback: resolve,
      delayMs,
    });
    void task;
  });
}

export function getStableQueueJitterMs(seed: string, maxJitterMs: number) {
  if (maxJitterMs <= 0) return 0;
  return hashSeed(seed) % (maxJitterMs + 1);
}

export async function runQueueProcessorsWithPacing<TContext>(params: {
  baseDelayMs: number;
  context: TContext;
  jitterMs: number;
  lane: string;
  ownerId?: string;
  processors: readonly QueueProcessorLike<TContext>[];
}) {
  for (const [index, processor] of params.processors.entries()) {
    if (index > 0) {
      const delayMs =
        params.baseDelayMs +
        getStableQueueJitterMs(
          `${params.lane}:${params.ownerId || "global"}:${processor.id}:${index}`,
          params.jitterMs,
        );
      await waitForScheduledResume(delayMs);
    }

    try {
      await Promise.resolve(processor.process(params.context));
    } catch {
      continue;
    }
  }
}

export function scheduleQueueProcessorResume(params: {
  callback: () => void;
  delayMs: number;
}): CancelableTask {
  return scheduleAfterInteractions(params.callback, Math.max(0, params.delayMs));
}
