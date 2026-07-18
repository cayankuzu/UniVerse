import type { QueryClient } from "@tanstack/react-query";

import {
  getAllLocalEventShadow,
  patchLocalEventShadow,
  persistLocalEventShadow,
  removeLocalEventShadow,
} from "../../../data/content/events/events.local";
import {
  getUploadQueue,
  removeUploadEntry,
  type UploadQueueEntry,
} from "../../../data/queues/uploadQueue";

import { patchQueuedEventCaches, removeQueuedEventCaches } from "./eventCreateQueueCache";
import { buildQueuedEvent, toEventCreateQueuePayload } from "./eventCreateQueue.shared";

export async function markQueuedEventFailed(entryId: string, errorMessage?: string) {
  await patchLocalEventShadow(entryId, {
    uploadError: errorMessage,
    uploadStatus: "failed",
  });
}

export async function markQueuedEventPending(entryId: string) {
  await patchLocalEventShadow(entryId, {
    uploadError: undefined,
    uploadStatus: "pending",
  });
}

export async function syncEventCreateQueueShadow(ownerId?: string) {
  const queue = await getUploadQueue("event-create", ownerId);
  const shadowItems = await getAllLocalEventShadow();
  const shadowIds = new Set(shadowItems.map((item) => String(item.id || "").trim()));

  for (const entry of queue) {
    await syncEventCreateShadowEntry(entry, shadowIds);
  }
}

async function syncEventCreateShadowEntry(entry: UploadQueueEntry, shadowIds: Set<string>) {
  const payload = toEventCreateQueuePayload(entry);
  const uploadStatus =
    entry.status === "failed" ? "failed" : entry.status === "uploading" ? "uploading" : "pending";

  if (!shadowIds.has(entry.id)) {
    await persistLocalEventShadow(
      buildQueuedEvent({
        payload,
        status: uploadStatus,
        tempId: entry.id,
        uploadError: entry.errorMessage,
      }),
    );
    return;
  }

  await patchLocalEventShadow(entry.id, {
    uploadError: entry.errorMessage,
    uploadStatus,
  });
}

export async function removeQueuedEventCreateEntry(params: {
  entryId: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  const shadowItems = await getAllLocalEventShadow();
  const target = shadowItems.find((item) => String(item.id || "").trim() === params.entryId);
  const username = String(target?.clubUsername || "").trim();

  await removeUploadEntry(params.entryId);
  await removeLocalEventShadow(params.entryId);
  removeQueuedEventCaches({
    eventId: params.entryId,
    queryClient: params.queryClient,
    username,
    viewerKey: params.viewerKey,
  });
}

export async function persistQueuedEventShadow(params: {
  event: ReturnType<typeof buildQueuedEvent>;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  await persistLocalEventShadow(params.event);
  patchQueuedEventCaches({
    event: params.event,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
  });
}
