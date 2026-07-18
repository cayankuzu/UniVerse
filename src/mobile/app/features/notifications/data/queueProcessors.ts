import type { RegisteredMutationQueueProcessor } from "../../../data/queues/types";
import { processFollowRequestResolutionActionQueue } from "./followRequestActionQueue";

export function getNotificationsMutationQueueProcessors(): RegisteredMutationQueueProcessor[] {
  return [
    {
      id: "notifications-follow-request-resolution",
      process: ({ ownerId, queryClient }) =>
        processFollowRequestResolutionActionQueue({
          ownerId,
          queryClient,
        }),
    },
  ];
}
