import type { QueryClient } from "@tanstack/react-query";
import type { CommentItem } from "../contracts/api";
import { createClientMutationId } from "../mutations/clientMutation";
import {
  enqueueMutationAction,
  processMutationActionQueue,
  subscribeMutationAction,
  type MutationActionQueueEntry,
} from "../queues/mutationActionQueue";
import { AlbumAPI } from "./albums.api";
import { EventAPI } from "./events.api";
import { refreshAlbumMutationScopes } from "./albumMutationCache";
import { refreshEventMutationScopes } from "./eventMutationCache";
import {
  assertAlbumCommentCreateAllowed,
  assertEventCommentCreateAllowed,
} from "../social/blockedInteractionGuard";

interface BaseCommentCreatePayload {
  clientMutationId?: string | null;
  optimisticCommentId: string;
  parentId: string | null;
  text: string;
}

interface EventCommentCreatePayload extends BaseCommentCreatePayload {
  eventId: string;
}

interface AlbumCommentCreatePayload extends BaseCommentCreatePayload {
  eventId?: string;
  photoId: string;
}

function isEventCommentEntry(
  entry: MutationActionQueueEntry,
): entry is MutationActionQueueEntry & { payload: EventCommentCreatePayload } {
  return entry.kind === "event-comment-create";
}

function isAlbumCommentEntry(
  entry: MutationActionQueueEntry,
): entry is MutationActionQueueEntry & { payload: AlbumCommentCreatePayload } {
  return entry.kind === "album-comment-create";
}

export function buildEventCommentQueueEntryId(eventId: string, optimisticCommentId: string) {
  return `event-comment:${String(eventId || "").trim()}:${String(optimisticCommentId || "").trim()}`;
}

export function buildAlbumCommentQueueEntryId(photoId: string, optimisticCommentId: string) {
  return `album-comment:${String(photoId || "").trim()}:${String(optimisticCommentId || "").trim()}`;
}

export async function queueEventCommentCreateAction(
  payload: EventCommentCreatePayload & { ownerId?: string },
) {
  await assertEventCommentCreateAllowed({
    eventId: payload.eventId,
    parentId: payload.parentId,
    viewerIdHint: payload.ownerId,
  });
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildEventCommentQueueEntryId(payload.eventId, payload.optimisticCommentId),
    kind: "event-comment-create",
    ownerId,
    payload: {
      clientMutationId: payload.clientMutationId || createClientMutationId("event-comment"),
      ...serializedPayload,
    } as unknown as Record<string, unknown>,
  });
}

export async function queueAlbumCommentCreateAction(
  payload: AlbumCommentCreatePayload & { ownerId?: string },
) {
  await assertAlbumCommentCreateAllowed({
    parentId: payload.parentId,
    photoId: payload.photoId,
    viewerIdHint: payload.ownerId,
  });
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildAlbumCommentQueueEntryId(payload.photoId, payload.optimisticCommentId),
    kind: "album-comment-create",
    ownerId,
    payload: {
      clientMutationId: payload.clientMutationId || createClientMutationId("album-comment"),
      ...serializedPayload,
    } as unknown as Record<string, unknown>,
  });
}

export function subscribeToCommentCreateAction(
  entryId: string,
  params: {
    onFailed?: (error?: unknown) => void;
    onResolved?: (comment: CommentItem) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    if (event.status === "resolved") {
      params.onResolved?.(event.result as CommentItem);
      return;
    }
    params.onFailed?.(event.error);
  });
}

async function processOneCommentCreateAction(
  entry: MutationActionQueueEntry,
  queryClient: QueryClient,
) {
  if (isEventCommentEntry(entry)) {
    try {
      const saved = await EventAPI.addComment(
        entry.payload.eventId,
        entry.payload.text,
        entry.payload.parentId,
        { clientMutationId: entry.payload.clientMutationId },
      );
      refreshEventMutationScopes(queryClient, entry.payload.eventId);
      return saved;
    } catch (error) {
      refreshEventMutationScopes(queryClient, entry.payload.eventId);
      throw error;
    }
  }

  if (isAlbumCommentEntry(entry)) {
    try {
      const saved = await AlbumAPI.addPhotoComment(
        entry.payload.photoId,
        entry.payload.text,
        entry.payload.parentId,
        { clientMutationId: entry.payload.clientMutationId },
      );
      refreshAlbumMutationScopes(queryClient, entry.payload.eventId);
      return saved;
    } catch (error) {
      refreshAlbumMutationScopes(queryClient, entry.payload.eventId);
      throw error;
    }
  }

  throw new Error("Unsupported comment action.");
}

export async function processCommentCreateActionQueue(params: {
  entryId?: string;
  ownerId?: string;
  queryClient: QueryClient;
}) {
  await processMutationActionQueue({
    entryId: params.entryId,
    handler: async (entry) => processOneCommentCreateAction(entry, params.queryClient),
    kind: "event-comment-create",
    ownerId: params.ownerId,
  });
  await processMutationActionQueue({
    entryId: params.entryId,
    handler: async (entry) => processOneCommentCreateAction(entry, params.queryClient),
    kind: "album-comment-create",
    ownerId: params.ownerId,
  });
}
