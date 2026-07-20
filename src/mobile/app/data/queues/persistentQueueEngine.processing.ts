import type {
  PersistentQueueEntryBase,
  PersistentQueueEntryPatch,
  ProcessPersistentQueueOptions,
} from "./persistentQueueEngine.contracts";
import { shouldProcessEntryNow } from "./persistentQueueEngine.shared";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";

interface ProcessPersistentQueueKindParams<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
  TResult,
> extends ProcessPersistentQueueOptions<Kind, Status, Entry, TResult> {
  activeKinds: Set<Kind>;
  errorMessageFallback: string;
  failedStatus: Status;
  getNextRetryDelayMs: (attemptCount: number) => number;
  isRetryableError: (error: unknown) => boolean;
  patchEntry: (
    entryId: string,
    patch: PersistentQueueEntryPatch<Kind, Status>,
  ) => Promise<Entry | null>;
  pendingStatus: Status;
  readAllEntries: () => Promise<Entry[]>;
  removeEntry: (entryId: string) => Promise<void>;
  processingStatus: Status;
  retainRetryableErrors: boolean;
}

function getRetryDelayWithJitterMs(entryId: string, attemptCount: number, baseDelayMs: number) {
  if (baseDelayMs <= 0) return 0;
  const seed = `${entryId}:${attemptCount}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  const normalized = (Math.abs(hash) % 301) / 1000;
  return Math.round(baseDelayMs * (0.85 + normalized));
}

function waitForInteractionWindow() {
  return new Promise<void>((resolve) => {
    scheduleAfterInteractions(resolve, 0);
  });
}

export async function processPersistentQueueKind<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
  TResult,
>(params: ProcessPersistentQueueKindParams<Kind, Status, Entry, TResult>) {
  while (params.activeKinds.has(params.kind)) {
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  params.activeKinds.add(params.kind);

  try {
    for (;;) {
      const entries = await params.readAllEntries();
      const nowMs = Date.now();
      const queue = entries
        .filter(
          (entry) =>
            entry.kind === params.kind &&
            entry.status === params.pendingStatus &&
            shouldProcessEntryNow(entry, nowMs) &&
            (!params.entryId || entry.id === params.entryId) &&
            (!params.ownerId || !entry.ownerId || entry.ownerId === params.ownerId) &&
            (!params.shouldProcess || params.shouldProcess(entry)),
        )
        .sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
      if (queue.length === 0) break;

      const processEntry = async (entry: Entry) => {
        if (params.deferUntilInteractionIdle !== false) {
          await waitForInteractionWindow();
        }
        const runningEntry = await params.patchEntry(entry.id, {
          errorMessage: undefined,
          nextProcessAt: null,
          status: params.processingStatus,
        });
        if (!runningEntry) return;

        try {
          const result = await params.handler(runningEntry);
          const nextEntryPatch = await params.onResolved?.(runningEntry, result);
          if (nextEntryPatch) {
            await params.patchEntry(runningEntry.id, nextEntryPatch);
            return;
          }
          await params.removeEntry(runningEntry.id);
        } catch (error) {
          const nextAttemptCount = runningEntry.attemptCount + 1;
          const retryable = params.isRetryableError(error);
          const shouldRetry =
            retryable &&
            (params.retainRetryableErrors || nextAttemptCount < runningEntry.maxAttempts);
          const nextRetryDelayMs = shouldRetry
            ? getRetryDelayWithJitterMs(
                runningEntry.id,
                nextAttemptCount,
                params.getNextRetryDelayMs(nextAttemptCount),
              )
            : 0;
          const nextEntry = await params.patchEntry(runningEntry.id, {
            attemptCount: nextAttemptCount,
            errorMessage: String(
              (error as { message?: string } | null)?.message || params.errorMessageFallback,
            ),
            nextProcessAt: shouldRetry
              ? new Date(Date.now() + nextRetryDelayMs).toISOString()
              : null,
            status: shouldRetry ? params.pendingStatus : params.failedStatus,
            terminalAt: shouldRetry ? null : new Date().toISOString(),
          });
          if (!nextEntry || shouldRetry) return;
          await params.onFailed?.(nextEntry, error);
        }
      };

      const concurrency = Math.max(1, Math.floor(params.maxConcurrentEntries || 1));
      for (let index = 0; index < queue.length; index += concurrency) {
        await Promise.all(queue.slice(index, index + concurrency).map(processEntry));
      }
    }
  } finally {
    params.activeKinds.delete(params.kind);
  }
}
