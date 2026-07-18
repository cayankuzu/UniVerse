export type QueueResumeChannel = "mutation" | "upload";

const listeners = {
  mutation: new Set<() => void>(),
  upload: new Set<() => void>(),
} satisfies Record<QueueResumeChannel, Set<() => void>>;

export function emitQueueResumeSignal(channel: QueueResumeChannel) {
  listeners[channel].forEach((listener) => listener());
}

export function subscribeQueueResumeSignal(channel: QueueResumeChannel, listener: () => void) {
  listeners[channel].add(listener);
  return () => {
    listeners[channel].delete(listener);
  };
}
