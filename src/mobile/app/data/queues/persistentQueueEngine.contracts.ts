export interface PersistentQueueEntryBase<Kind extends string, Status extends string> {
  attemptCount: number;
  createdAt: string;
  errorMessage?: string;
  id: string;
  kind: Kind;
  maxAttempts: number;
  nextProcessAt?: string | null;
  ownerId?: string;
  payload: Record<string, unknown>;
  schemaVersion?: number;
  status: Status;
  terminalAt?: string | null;
  updatedAt: string;
}

type MutableQueueEntryFields<Kind extends string, Status extends string> = Pick<
  PersistentQueueEntryBase<Kind, Status>,
  "attemptCount" | "errorMessage" | "nextProcessAt" | "payload" | "status" | "terminalAt"
>;

export type PersistentQueueEntryPatch<Kind extends string, Status extends string> = Partial<
  MutableQueueEntryFields<Kind, Status>
>;

export interface CreatePersistentQueueOptions<_Kind extends string, Status extends string> {
  defaultMaxAttempts?: number;
  errorMessageFallback: string;
  failedStatus: Status;
  isRetryableError: (error: unknown) => boolean;
  logReadError?: (error: unknown) => void;
  maxRetryDelayMs?: number;
  pendingStatus: Status;
  processingStatus: Status;
  retryBaseDelayMs?: number;
  schemaVersion?: number;
  staleProcessingMs?: number;
  storageKey: string;
}

export interface ProcessPersistentQueueOptions<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
  TResult,
> {
  entryId?: string;
  handler: (entry: Entry) => Promise<TResult>;
  kind: Kind;
  onFailed?: (entry: Entry, error: unknown) => Promise<void> | void;
  onResolved?: (
    entry: Entry,
    result: TResult,
  ) =>
    | Promise<PersistentQueueEntryPatch<Kind, Status> | null | void>
    | PersistentQueueEntryPatch<Kind, Status>
    | null
    | void;
  ownerId?: string;
  shouldProcess?: (entry: Entry) => boolean;
}
