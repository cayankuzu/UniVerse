import type { QueryClient } from "@tanstack/react-query";
import type { EventWithMeta } from "../../../data/contracts/content";
import { EventAPI } from "../../../data/content/events.api";
import {
  patchLocalEventShadow,
  replaceLocalEventShadow,
} from "../../../data/content/events/events.local";
import { patchUploadEntry, type UploadQueueEntry } from "../../../data/queues/uploadQueue";
import { writeUploadProgress } from "../../../data/queues/uploadProgress";
import { StorageAPI } from "../../../data/storage/storage";
import { resolveMediaUploadFileInfo } from "../../../shared/media/mediaVideoUtils";

import { patchQueuedEventCaches } from "./eventCreateQueueCache";
import { buildOptimisticEvent } from "./createEventOptimistic";
import { toEventCreateQueuePayload } from "./eventCreateQueue.shared";

async function patchEventCreateProgress(
  entry: UploadQueueEntry,
  patch: {
    percent: number;
    stage: string;
  },
) {
  const nextPayload = writeUploadProgress(entry.payload, {
    hint: "Uygulamadan cikmayin. Etkinlik arka planda paylasiliyor.",
    percent: patch.percent,
    stage: patch.stage,
    title: "Etkinlik paylasiliyor",
  });
  const nextEntry = await patchUploadEntry(entry.id, {
    payload: nextPayload,
    status: "uploading",
  });
  return nextEntry?.payload ?? nextPayload;
}

export async function handleEventCreateEntry(params: {
  entry: UploadQueueEntry;
  queryClient: QueryClient;
  viewerKey: string;
}): Promise<EventWithMeta> {
  let payload = toEventCreateQueuePayload(params.entry);
  let progressPayload = params.entry.payload;

  await patchLocalEventShadow(params.entry.id, {
    uploadError: undefined,
    uploadStatus: "uploading",
  });
  progressPayload = await patchEventCreateProgress(params.entry, {
    percent: 18,
    stage: "Kapak görseli yükleniyor",
  });
  payload = toEventCreateQueuePayload({
    ...params.entry,
    payload: progressPayload,
  });

  const image = payload.coverImageUri
    ? await StorageAPI.uploadFile(
        {
          uri: payload.coverImageUri,
          ...resolveMediaUploadFileInfo(payload.coverImageUri, { baseName: "event-cover" }),
        },
        "events",
      )
    : "";
  progressPayload =
    (
      await patchUploadEntry(params.entry.id, {
        payload: writeUploadProgress(progressPayload, {
          hint: "Uygulamadan cikmayin. Etkinlik arka planda paylasiliyor.",
          percent: 72,
          stage: "Etkinlik yayinlaniyor",
          title: "Etkinlik paylasiliyor",
        }),
        status: "uploading",
      })
    )?.payload ?? progressPayload;

  const createdEvent = await EventAPI.create(buildCreateEventRequest(payload, image), {
    localEventBuilder: (eventId) =>
      buildOptimisticEvent({
        coverImageUri: image,
        form: payload.form,
        selectedCategories: payload.selectedCategories,
        tempId: eventId,
        userData: payload.userData,
      }),
  });

  await replaceLocalEventShadow(params.entry.id, createdEvent);
  progressPayload =
    (
      await patchUploadEntry(params.entry.id, {
        payload: writeUploadProgress(progressPayload, {
          hint: "Uygulamadan cikmayin. Etkinlik arka planda paylasiliyor.",
          percent: 96,
          stage: "Etkinlik gönderiye ekleniyor",
          title: "Etkinlik paylasiliyor",
        }),
        status: "uploading",
      })
    )?.payload ?? progressPayload;
  patchQueuedEventCaches({
    event: createdEvent,
    previousId: params.entry.id,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
  });

  return createdEvent;
}

function buildCreateEventRequest(
  payload: ReturnType<typeof toEventCreateQueuePayload>,
  image: string,
) {
  return {
    access: payload.form.access,
    address: payload.form.address.trim() || payload.form.location.trim(),
    capacity: parseInt(payload.form.capacity, 10) || 100,
    categories: payload.selectedCategories,
    category: payload.selectedCategories[0] || "Genel",
    date: payload.form.startDate.trim(),
    description: payload.form.description.trim(),
    endDate: (payload.form.endDate || payload.form.startDate).trim(),
    endTime: payload.form.endTime.trim() || "12:00",
    fee:
      payload.form.fee === "Ücretli" && payload.form.feeAmount
        ? `${payload.form.feeAmount} TL`
        : payload.form.fee,
    image,
    level: payload.form.level,
    location: payload.form.location.trim(),
    materials: payload.form.materials.trim(),
    startDate: payload.form.startDate.trim(),
    startTime: payload.form.startTime.trim() || "10:00",
    targetAudience: payload.form.targetAudience.trim(),
    title: payload.form.title.trim(),
    type: payload.form.type,
  };
}
