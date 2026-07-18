import { getEventMutationQueueProcessors } from "../../features/events/public/queues";
import { getNotificationsMutationQueueProcessors } from "../../features/notifications/public/queues";
import { getProfileMutationQueueProcessors } from "../../features/profile/public/queues";
import type {
  MutationQueueProcessorContext,
  RegisteredMutationQueueProcessor,
} from "../../data/queues/types";
import { runQueueProcessorsWithPacing } from "./queueResumeScheduler";

const MUTATION_PROCESSOR_SPACING_MS = 180;
const MUTATION_PROCESSOR_JITTER_MS = 140;

const registeredMutationQueueProcessors = Object.freeze([
  ...getEventMutationQueueProcessors(),
  ...getNotificationsMutationQueueProcessors(),
  ...getProfileMutationQueueProcessors(),
]) satisfies readonly RegisteredMutationQueueProcessor[];

export function getRegisteredMutationQueueProcessors(): RegisteredMutationQueueProcessor[] {
  return [...registeredMutationQueueProcessors];
}

export async function resumeRegisteredMutationQueues(context: MutationQueueProcessorContext) {
  await runQueueProcessorsWithPacing({
    baseDelayMs: MUTATION_PROCESSOR_SPACING_MS,
    context,
    jitterMs: MUTATION_PROCESSOR_JITTER_MS,
    lane: "mutation",
    ownerId: context.ownerId,
    processors: registeredMutationQueueProcessors,
  });
}
