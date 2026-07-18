import { getEventUploadQueueProcessors } from "../../features/events/public/queues";
import { getProfileUploadQueueProcessors } from "../../features/profile/public/queues";
import type {
  RegisteredUploadQueueProcessor,
  UploadQueueProcessorContext,
} from "../../data/queues/types";
import { runQueueProcessorsWithPacing } from "./queueResumeScheduler";

const UPLOAD_PROCESSOR_SPACING_MS = 260;
const UPLOAD_PROCESSOR_JITTER_MS = 180;

const registeredUploadQueueProcessors = Object.freeze([
  ...getProfileUploadQueueProcessors(),
  ...getEventUploadQueueProcessors(),
]) satisfies readonly RegisteredUploadQueueProcessor[];

export function getRegisteredUploadQueueProcessors(): RegisteredUploadQueueProcessor[] {
  return [...registeredUploadQueueProcessors];
}

export async function resumeRegisteredUploadQueues(context: UploadQueueProcessorContext) {
  await runQueueProcessorsWithPacing({
    baseDelayMs: UPLOAD_PROCESSOR_SPACING_MS,
    context,
    jitterMs: UPLOAD_PROCESSOR_JITTER_MS,
    lane: "upload",
    ownerId: context.ownerId,
    processors: registeredUploadQueueProcessors,
  });
}
