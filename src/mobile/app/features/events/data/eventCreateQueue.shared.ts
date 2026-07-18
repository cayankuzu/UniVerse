import type { EventWithMeta } from "../../../data/contracts/content";
import type { UploadQueueEntry } from "../../../data/queues/uploadQueue";

import { buildOptimisticEvent } from "./createEventOptimistic";
import type { EventCreateQueuePayload, EventCreateQueueUser } from "./eventCreateQueue.types";

export function toEventCreateQueuePayload(entry: UploadQueueEntry): EventCreateQueuePayload {
  return entry.payload as unknown as EventCreateQueuePayload;
}

export function buildQueuedEvent(params: {
  payload: EventCreateQueuePayload;
  status: EventWithMeta["uploadStatus"];
  tempId: string;
  uploadError?: string;
}): EventWithMeta {
  return {
    ...buildOptimisticEvent({
      coverImageUri: params.payload.coverImageUri,
      form: params.payload.form,
      selectedCategories: params.payload.selectedCategories,
      tempId: params.tempId,
      userData: params.payload.userData,
    }),
    uploadError: params.uploadError,
    uploadStatus: params.status,
  };
}

export function buildQueuedEventPayload(params: {
  clientMutationId: string;
  coverImageUri: string;
  form: EventCreateQueuePayload["form"];
  selectedCategories: string[];
  userData: EventCreateQueueUser;
}) {
  return {
    clientMutationId: params.clientMutationId,
    coverImageUri: params.coverImageUri,
    form: params.form,
    selectedCategories: params.selectedCategories,
    userData: params.userData,
  } satisfies EventCreateQueuePayload;
}
