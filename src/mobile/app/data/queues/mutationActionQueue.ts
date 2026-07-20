import { logError } from "../../platform/observability";
import {
  createPersistentQueueEngine,
  type PersistentQueueEntryBase,
  type PersistentQueueEntryPatch,
  type ProcessPersistentQueueOptions,
} from "./persistentQueueEngine";
import { isRetryableQueueError } from "./queueErrorPolicy";
import { emitQueueResumeSignal } from "./runtimeSignals";

export const MUTATION_ACTION_QUEUE_STORAGE_KEY = "mutation-action-queue:v1";

export type MutationActionQueueKind =
  | "album-comment-create"
  | "album-like-toggle"
  | "event-comment-create"
  | "event-attendance-toggle"
  | "event-like-toggle"
  | "follow-request-resolution"
  | "follow-toggle";

export type MutationActionQueueStatus = "failed" | "pending" | "running";

export type MutationActionQueueEntry = PersistentQueueEntryBase<
  MutationActionQueueKind,
  MutationActionQueueStatus
>;

type MutationActionQueueListener = (event: {
  entry: MutationActionQueueEntry;
  error?: unknown;
  result?: unknown;
  status: "failed" | "resolved";
}) => void;

const listeners = new Map<string, Set<MutationActionQueueListener>>();
const mutationQueueEngine = createPersistentQueueEngine<
  MutationActionQueueKind,
  MutationActionQueueStatus,
  MutationActionQueueEntry
>({
  errorMessageFallback: "Mutation failed.",
  failedStatus: "failed",
  isRetryableError: (error) => isRetryableQueueError(error, { useHttpStatus: true }),
  logReadError: (error) => {
    logError(error, {
      captureInSentry: false,
      meta: { operation: "read-queue", scope: "mutation-action-queue" },
      name: "mutation-queue-read-failed",
    });
  },
  pendingStatus: "pending",
  processingStatus: "running",
  retainRetryableErrors: true,
  storageKey: MUTATION_ACTION_QUEUE_STORAGE_KEY,
});

function notifyMutationActionListeners(
  entryId: string,
  event: {
    entry: MutationActionQueueEntry;
    error?: unknown;
    result?: unknown;
    status: "failed" | "resolved";
  },
) {
  const entryListeners = listeners.get(entryId);
  if (!entryListeners?.size) return;
  entryListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      logError(error, {
        captureInSentry: false,
        meta: {
          entryId,
          operation: "notify-listener",
          scope: "mutation-action-queue",
        },
        name: "mutation-queue-listener-failed",
      });
    }
  });
  listeners.delete(entryId);
}

export function subscribeMutationAction(entryId: string, listener: MutationActionQueueListener) {
  const normalizedId = String(entryId || "").trim();
  if (!normalizedId) return () => undefined;
  const entryListeners = listeners.get(normalizedId) || new Set<MutationActionQueueListener>();
  entryListeners.add(listener);
  listeners.set(normalizedId, entryListeners);

  return () => {
    const current = listeners.get(normalizedId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(normalizedId);
    }
  };
}

export async function getMutationActionQueue(kind?: MutationActionQueueKind, ownerId?: string) {
  return mutationQueueEngine.getQueue(kind, ownerId);
}

export async function getMutationActionDeadLetterQueue(ownerId?: string) {
  const entries = await mutationQueueEngine.getQueue(undefined, ownerId);
  return entries.filter((entry) => entry.status === "failed" && Boolean(entry.terminalAt));
}

export async function enqueueMutationAction(params: {
  id: string;
  kind: MutationActionQueueKind;
  maxAttempts?: number;
  ownerId?: string;
  payload: Record<string, unknown>;
}) {
  const { entry } = await mutationQueueEngine.enqueueOrPatch(params, () => ({}));
  emitQueueResumeSignal("mutation");
  return entry;
}

export async function upsertMutationAction(params: {
  id: string;
  kind: MutationActionQueueKind;
  maxAttempts?: number;
  ownerId?: string;
  patchExisting: (
    entry: MutationActionQueueEntry,
  ) => PersistentQueueEntryPatch<MutationActionQueueKind, MutationActionQueueStatus>;
  payload: Record<string, unknown>;
}) {
  const { patchExisting, ...entryParams } = params;
  const result = await mutationQueueEngine.enqueueOrPatch(entryParams, patchExisting);
  emitQueueResumeSignal("mutation");
  return result;
}

export async function patchMutationActionEntry(
  entryId: string,
  patch: PersistentQueueEntryPatch<MutationActionQueueKind, MutationActionQueueStatus>,
): Promise<MutationActionQueueEntry | null> {
  const entry = await mutationQueueEngine.patchEntry(entryId, patch);
  if (entry && (patch.status === "pending" || patch.status === "running" || patch.nextProcessAt)) {
    emitQueueResumeSignal("mutation");
  }
  return entry;
}

export async function getMutationActionEntry(entryId: string) {
  return mutationQueueEngine.getEntry(entryId);
}

export async function removeMutationActionEntry(entryId: string) {
  await mutationQueueEngine.removeEntry(entryId);
}

export async function retryMutationActionEntry(entryId: string) {
  const entry = await mutationQueueEngine.retryEntry(entryId);
  emitQueueResumeSignal("mutation");
  return entry;
}

export async function processMutationActionQueue<TResult>(
  params: ProcessPersistentQueueOptions<
    MutationActionQueueKind,
    MutationActionQueueStatus,
    MutationActionQueueEntry,
    TResult
  >,
) {
  await mutationQueueEngine.processQueue({
    ...params,
    deferUntilInteractionIdle: params.deferUntilInteractionIdle ?? false,
    onFailed: async (entry, error) => {
      await params.onFailed?.(entry, error);
      notifyMutationActionListeners(entry.id, {
        entry,
        error,
        status: "failed",
      });
    },
    onResolved: async (entry, result) => {
      const nextEntryPatch = await params.onResolved?.(entry, result);
      if (!nextEntryPatch) {
        notifyMutationActionListeners(entry.id, {
          entry,
          result,
          status: "resolved",
        });
      }
      return nextEntryPatch;
    },
  });
}

export async function clearMutationActionQueueStorage() {
  listeners.clear();
  await mutationQueueEngine.clearStorage();
}
