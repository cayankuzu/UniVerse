import type {
  RegisteredMutationQueueProcessor,
  RegisteredUploadQueueProcessor,
} from "../../../data/queues/types";
import { processContentToggleQueue } from "../../../data/content";
import { processAlbumUploadQueue } from "./albumUploadQueueRepository";
import { processCommentCreateActionQueue } from "./commentCreateQueue";
import { processEventCreateQueue } from "./eventCreateQueueRepository";

export function getEventMutationQueueProcessors(): RegisteredMutationQueueProcessor[] {
  return [
    {
      id: "events-comment-create",
      process: async ({ ownerId, queryClient }) => {
        await processCommentCreateActionQueue({
          ownerId,
          queryClient,
        });
      },
    },
    {
      id: "content-final-state-toggles",
      process: async ({ ownerId, queryClient }) => {
        await processContentToggleQueue({
          ownerId,
          queryClient,
        });
      },
    },
  ];
}

export function getEventUploadQueueProcessors(): RegisteredUploadQueueProcessor[] {
  return [
    {
      id: "events-create",
      process: async ({ ownerId, queryClient, viewerKey }) => {
        await processEventCreateQueue({
          ownerId,
          queryClient,
          viewerKey,
        });
      },
    },
    {
      id: "albums-upload",
      process: async ({ accountType, ownerId, queryClient, userData, viewerKey }) => {
        await processAlbumUploadQueue({
          accountType,
          ownerId,
          queryClient,
          userData,
          viewerKey,
        });
      },
    },
  ];
}
