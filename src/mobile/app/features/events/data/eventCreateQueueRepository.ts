import type { QueryClient } from "@tanstack/react-query";
import type { EventWithMeta } from "../../../data/contracts/content";
import {
  enqueueUpload,
  getUploadEntry,
  getUploadQueue,
  processUploadQueue,
  retryUploadEntry,
} from "../../../data/queues/uploadQueue";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import {
  createEventCreateProgress,
  writeUploadProgress,
} from "../../../data/queues/uploadProgress";

import type { EventCreateQueuePayload, EventCreateQueueUser } from "./eventCreateQueue.types";
import { buildQueuedEvent, buildQueuedEventPayload } from "./eventCreateQueue.shared";
import { handleEventCreateEntry } from "./eventCreateQueue.processor";
import {
  markQueuedEventFailed,
  markQueuedEventPending,
  persistQueuedEventShadow,
  removeQueuedEventCreateEntry,
  syncEventCreateQueueShadow,
} from "./eventCreateQueue.shadow";

export async function queueEventCreate(params: {
  coverImageUri: string;
  form: EventCreateQueuePayload["form"];
  ownerId?: string;
  queryClient: QueryClient;
  selectedCategories: string[];
  userData: EventCreateQueueUser;
  viewerKey: string;
}) {
  const tempId = `temp-event:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const clientMutationId = createClientMutationId("event-create");
  const payload = buildQueuedEventPayload({
    clientMutationId,
    coverImageUri: params.coverImageUri,
    form: params.form,
    selectedCategories: params.selectedCategories,
    userData: params.userData,
  });
  const optimisticEvent = buildQueuedEvent({
    payload,
    status: "pending",
    tempId,
  });

  await persistQueuedEventShadow({
    event: optimisticEvent,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
  });
  await enqueueUpload({
    id: tempId,
    kind: "event-create",
    ownerId: params.ownerId,
    payload: writeUploadProgress(payload, createEventCreateProgress()),
  });

  return { optimisticEvent, tempId };
}

export { syncEventCreateQueueShadow } from "./eventCreateQueue.shadow";

export async function startQueuedEventCreate(params: {
  coverImageUri: string;
  form: EventCreateQueuePayload["form"];
  ownerId?: string;
  queryClient: QueryClient;
  selectedCategories: string[];
  userData: EventCreateQueueUser;
  viewerKey: string;
}) {
  const queued = await queueEventCreate(params);
  void processEventCreateQueue({
    entryId: queued.tempId,
    ownerId: params.ownerId,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
  });
  return queued;
}

export async function processEventCreateQueue(params: {
  entryId?: string;
  ownerId?: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  await syncEventCreateQueueShadow(params.ownerId);

  let createdEvent: EventWithMeta | null = null;
  await processUploadQueue({
    entryId: params.entryId,
    ownerId: params.ownerId,
    kind: "event-create",
    handler: async (entry) => {
      createdEvent = await handleEventCreateEntry({
        entry,
        queryClient: params.queryClient,
        viewerKey: params.viewerKey,
      });
    },
    onFailed: async (entry) => {
      await markQueuedEventFailed(entry.id, entry.errorMessage);
    },
  });

  await syncEventCreateQueueShadow(params.ownerId);
  await throwIfEventCreateStillFailed(params.entryId, params.ownerId);
  return createdEvent;
}

export function retryQueuedEventCreate(params: {
  entryId: string;
  ownerId?: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  return retryEventCreate(params);
}

export function removeQueuedEventCreate(params: {
  entryId: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  return removeQueuedEventCreateEntry(params);
}

export async function retryEventCreate(params: {
  entryId: string;
  ownerId?: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  await retryUploadEntry(params.entryId);
  return processEventCreateWithReset(params);
}

async function processEventCreateWithReset(params: {
  entryId: string;
  ownerId?: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  await markQueuedEventPending(params.entryId);
  return processEventCreateQueue(params);
}

async function throwIfEventCreateStillFailed(entryId?: string, ownerId?: string) {
  const latestEntry = await resolveEventCreateEntry(entryId, ownerId);
  if (latestEntry?.status !== "failed") return;

  await markQueuedEventFailed(latestEntry.id, latestEntry.errorMessage);
  throw new Error(latestEntry.errorMessage || "Etkinlik oluşturulamadı.");
}

async function resolveEventCreateEntry(entryId?: string, ownerId?: string) {
  if (!entryId) return null;

  const scopedEntry = await getUploadQueue("event-create", ownerId).then(
    (items) => items.find((item) => item.id === entryId) || null,
  );
  if (scopedEntry) return scopedEntry;
  return getUploadEntry(entryId);
}
