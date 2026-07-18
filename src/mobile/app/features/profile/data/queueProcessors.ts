import type {
  RegisteredMutationQueueProcessor,
  RegisteredUploadQueueProcessor,
} from "../../../data/queues/types";
import { processFollowActionQueue } from "./followActionQueue";
import { processProfileUpdateQueue } from "./profileUpdateQueue";

const PROFILE_MUTATION_QUEUE_PROCESSORS: RegisteredMutationQueueProcessor[] = [
  {
    id: "profile-follow-toggle",
    process: ({ ownerId, queryClient }) =>
      processFollowActionQueue({
        ownerId,
        queryClient,
      }),
  },
];

const PROFILE_UPLOAD_QUEUE_PROCESSORS: RegisteredUploadQueueProcessor[] = [
  {
    id: "profile-update",
    process: ({ ownerId, queryClient, updateUserData, viewerKey }) =>
      processProfileUpdateQueue({
        ownerId,
        queryClient,
        updateUserData,
        viewerKey,
      }),
  },
];

export function getProfileMutationQueueProcessors(): RegisteredMutationQueueProcessor[] {
  return PROFILE_MUTATION_QUEUE_PROCESSORS;
}

export function getProfileUploadQueueProcessors(): RegisteredUploadQueueProcessor[] {
  return PROFILE_UPLOAD_QUEUE_PROCESSORS;
}
