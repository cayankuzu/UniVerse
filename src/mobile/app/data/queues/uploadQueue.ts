import { logError } from "../../platform/observability";
import {
  createPersistentQueueEngine,
  type PersistentQueueEntryBase,
  type PersistentQueueEntryPatch,
  type ProcessPersistentQueueOptions,
} from "./persistentQueueEngine";
import { isRetryableQueueError } from "./queueErrorPolicy";
import { emitQueueResumeSignal } from "./runtimeSignals";

export const UPLOAD_QUEUE_STORAGE_KEY = "upload-queue:v1";

export type UploadQueueKind = "album-photo" | "event-create" | "profile-update";

export type UploadQueueStatus = "failed" | "pending" | "uploading";

export type UploadQueueEntry = PersistentQueueEntryBase<UploadQueueKind, UploadQueueStatus>;

const UPLOAD_NON_RETRYABLE_KEYWORDS = [
  "boyutu veya formati uygun degil",
  "fotograf boyutu cok buyuk",
  "video boyutu cok buyuk",
  "video suresi cok uzun",
  "dosya seçilmedi",
];

export function isRetryableUploadError(error: unknown) {
  return isRetryableQueueError(error, {
    additionalNonRetryableKeywords: UPLOAD_NON_RETRYABLE_KEYWORDS,
    additionalRetryableKeywords: ["http 429", "cok fazla", "çok fazla"],
  });
}

const uploadQueueEngine = createPersistentQueueEngine<
  UploadQueueKind,
  UploadQueueStatus,
  UploadQueueEntry
>({
  errorMessageFallback: "Upload failed.",
  failedStatus: "failed",
  isRetryableError: isRetryableUploadError,
  logReadError: (error) => {
    logError(error, {
      captureInSentry: false,
      meta: { operation: "read-queue", scope: "upload-queue" },
      name: "upload-queue-read-failed",
    });
  },
  pendingStatus: "pending",
  processingStatus: "uploading",
  storageKey: UPLOAD_QUEUE_STORAGE_KEY,
});

export async function getUploadQueue(kind?: UploadQueueKind, ownerId?: string) {
  return uploadQueueEngine.getQueue(kind, ownerId);
}

export async function getUploadDeadLetterQueue(ownerId?: string) {
  const entries = await uploadQueueEngine.getQueue(undefined, ownerId);
  return entries.filter((entry) => entry.status === "failed" && Boolean(entry.terminalAt));
}

export async function enqueueUpload(params: {
  id: string;
  kind: UploadQueueKind;
  maxAttempts?: number;
  ownerId?: string;
  payload: Record<string, unknown>;
}) {
  const entry = await uploadQueueEngine.enqueue(params);
  emitQueueResumeSignal("upload");
  return entry;
}

export async function patchUploadEntry(
  entryId: string,
  patch: PersistentQueueEntryPatch<UploadQueueKind, UploadQueueStatus>,
) {
  const entry = await uploadQueueEngine.patchEntry(entryId, patch);
  if (entry) {
    emitQueueResumeSignal("upload");
  }
  return entry;
}

export async function getUploadEntry(entryId: string) {
  return uploadQueueEngine.getEntry(entryId);
}

export async function removeUploadEntry(entryId: string) {
  await uploadQueueEngine.removeEntry(entryId);
  emitQueueResumeSignal("upload");
}

export async function retryUploadEntry(entryId: string) {
  const entry = await uploadQueueEngine.retryEntry(entryId);
  emitQueueResumeSignal("upload");
  return entry;
}

export async function processUploadQueue<TResult>(
  params: ProcessPersistentQueueOptions<
    UploadQueueKind,
    UploadQueueStatus,
    UploadQueueEntry,
    TResult
  >,
) {
  await uploadQueueEngine.processQueue(params);
  emitQueueResumeSignal("upload");
}

export async function clearUploadQueueStorage() {
  await uploadQueueEngine.clearStorage();
}
