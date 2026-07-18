import { createPersistentQueueStorageApi } from "./persistentQueueEngine.storage";
import { processPersistentQueueKind } from "./persistentQueueEngine.processing";
import type {
  CreatePersistentQueueOptions,
  PersistentQueueEntryBase,
  ProcessPersistentQueueOptions,
} from "./persistentQueueEngine.contracts";

export type {
  CreatePersistentQueueOptions,
  PersistentQueueEntryBase,
  PersistentQueueEntryPatch,
  ProcessPersistentQueueOptions,
} from "./persistentQueueEngine.contracts";

export function createPersistentQueueEngine<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
>(options: CreatePersistentQueueOptions<Kind, Status>) {
  const activeKinds = new Set<Kind>();
  const defaultMaxAttempts = options.defaultMaxAttempts ?? 4;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 1_500;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 30_000;
  const staleProcessingMs = options.staleProcessingMs ?? 8_000;
  const schemaVersion = options.schemaVersion ?? 1;
  const storageApi = createPersistentQueueStorageApi<Kind, Status, Entry>({
    defaultMaxAttempts,
    logReadError: options.logReadError,
    pendingStatus: options.pendingStatus,
    processingStatus: options.processingStatus,
    schemaVersion,
    staleProcessingMs,
    storageKey: options.storageKey,
  });

  function getNextRetryDelayMs(attemptCount: number) {
    return Math.min(
      maxRetryDelayMs,
      retryBaseDelayMs * Math.max(1, 2 ** Math.max(0, attemptCount - 1)),
    );
  }

  async function processQueue<TResult>(
    params: ProcessPersistentQueueOptions<Kind, Status, Entry, TResult>,
  ) {
    await processPersistentQueueKind({
      ...params,
      activeKinds,
      errorMessageFallback: options.errorMessageFallback,
      failedStatus: options.failedStatus,
      getNextRetryDelayMs,
      isRetryableError: options.isRetryableError,
      patchEntry: storageApi.patchEntry,
      pendingStatus: options.pendingStatus,
      processingStatus: options.processingStatus,
      readAllEntries: storageApi.readAllEntries,
      removeEntry: storageApi.removeEntry,
    });
  }

  async function clearStorage() {
    activeKinds.clear();
    await storageApi.clearStorage();
  }

  return {
    clearStorage,
    enqueue: storageApi.enqueue,
    getEntry: storageApi.getEntry,
    getQueue: storageApi.getQueue,
    patchEntry: storageApi.patchEntry,
    processQueue,
    readAllEntries: storageApi.readAllEntries,
    removeEntry: storageApi.removeEntry,
    retryEntry: storageApi.retryEntry,
  };
}
