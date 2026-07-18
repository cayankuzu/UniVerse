import type { QueryClient } from "@tanstack/react-query";
import type { AttendResponse, LikeResponse } from "../contracts/api";
import { createClientMutationId } from "../mutations/clientMutation";
import {
  getMutationActionEntry,
  processMutationActionQueue,
  type MutationActionQueueKind,
  type MutationActionQueueEntry,
} from "../queues/mutationActionQueue";
import { likeAlbumPhoto } from "./albums.interactions";
import {
  getAlbumLikePayload,
  getEventAttendancePayload,
  getEventLikePayload,
  patchResolvedAlbumLikeCache,
  patchResolvedEventAttendanceCache,
  patchResolvedEventLikeCache,
} from "./contentToggleQueue.shared";
import { attendEvent, likeEvent } from "./events.interactions";

function buildRetryPatch<TPayload extends Record<string, unknown>>(params: {
  latestPayload: TPayload;
  previousCount: number;
  previousStateKey: string;
  previousStateValue: boolean;
}) {
  return {
    attemptCount: 0,
    errorMessage: undefined,
    nextProcessAt: new Date().toISOString(),
    payload: {
      ...params.latestPayload,
      previousCount: params.previousCount,
      [params.previousStateKey]: params.previousStateValue,
    } as unknown as Record<string, unknown>,
    status: "pending" as const,
  };
}

// Shared toggle processor: handles the common pattern of
// execute → patch cache → detect mid-flight changes → retry.
async function processToggleKind<TPayload, TResult>(config: {
  entryId?: string;
  extractPayload: (entry: MutationActionQueueEntry) => TPayload;
  handler: (payload: TPayload) => Promise<TResult>;
  kind: MutationActionQueueKind;
  onFailed: (queryClient: QueryClient, payload: TPayload) => void;
  onResolved: (queryClient: QueryClient, payload: TPayload, result: TResult) => void;
  ownerId?: string;
  queryClient: QueryClient;
  retryCheck: (params: {
    latestPayload: TPayload;
    originalPayload: TPayload;
    result: TResult;
  }) => ReturnType<typeof buildRetryPatch> | null;
}) {
  await processMutationActionQueue({
    entryId: config.entryId,
    handler: async (entry) => config.handler(config.extractPayload(entry)),
    kind: config.kind,
    onFailed: (entry) => config.onFailed(config.queryClient, config.extractPayload(entry)),
    onResolved: async (entry, result) => {
      const payload = config.extractPayload(entry);
      const resolved = result as TResult;
      config.onResolved(config.queryClient, payload, resolved);
      const latestEntry = await getMutationActionEntry(entry.id);
      const latestPayload = latestEntry ? config.extractPayload(latestEntry) : payload;
      if (latestEntry && latestEntry.status === "running") {
        return config.retryCheck({ latestPayload, originalPayload: payload, result: resolved });
      }
      return null;
    },
    ownerId: config.ownerId,
  });
}

export async function processContentToggleQueue(params: {
  entryId?: string;
  ownerId?: string;
  queryClient: QueryClient;
}) {
  // Event likes
  await processToggleKind({
    ...params,
    extractPayload: getEventLikePayload,
    handler: (p) =>
      likeEvent(p.eventId, {
        clientMutationId: p.clientMutationId || createClientMutationId("event-like"),
        desiredLiked: p.targetLiked,
      }),
    kind: "event-like-toggle",
    onFailed: (qc, p) =>
      patchResolvedEventLikeCache(qc, p, { count: p.previousCount, liked: p.previousLiked }),
    onResolved: (qc, p, r) => patchResolvedEventLikeCache(qc, p, r as LikeResponse),
    retryCheck: ({ latestPayload, originalPayload, result }) =>
      latestPayload.targetLiked !== originalPayload.targetLiked
        ? buildRetryPatch({
            latestPayload,
            previousCount: (result as LikeResponse).count,
            previousStateKey: "previousLiked",
            previousStateValue: (result as LikeResponse).liked,
          })
        : null,
  });

  // Event attendance
  await processToggleKind({
    ...params,
    extractPayload: getEventAttendancePayload,
    handler: (p) =>
      attendEvent(p.eventId, {
        clientMutationId: p.clientMutationId || createClientMutationId("event-attend"),
        desiredJoined: p.targetJoined,
      }),
    kind: "event-attendance-toggle",
    onFailed: (qc, p) =>
      patchResolvedEventAttendanceCache(qc, p, {
        count: p.previousCount,
        joined: p.previousJoined,
      }),
    onResolved: (qc, p, r) => patchResolvedEventAttendanceCache(qc, p, r as AttendResponse),
    retryCheck: ({ latestPayload, originalPayload, result }) =>
      latestPayload.targetJoined !== originalPayload.targetJoined
        ? buildRetryPatch({
            latestPayload,
            previousCount: (result as AttendResponse).count,
            previousStateKey: "previousJoined",
            previousStateValue: (result as AttendResponse).joined,
          })
        : null,
  });

  // Album likes
  await processToggleKind({
    ...params,
    extractPayload: getAlbumLikePayload,
    handler: (p) =>
      likeAlbumPhoto(p.photoId, {
        clientMutationId: p.clientMutationId || createClientMutationId("album-like"),
        desiredLiked: p.targetLiked,
      }),
    kind: "album-like-toggle",
    onFailed: (qc, p) =>
      patchResolvedAlbumLikeCache(qc, p, { count: p.previousCount, liked: p.previousLiked }),
    onResolved: (qc, p, r) => patchResolvedAlbumLikeCache(qc, p, r as LikeResponse),
    retryCheck: ({ latestPayload, originalPayload, result }) =>
      latestPayload.targetLiked !== originalPayload.targetLiked
        ? buildRetryPatch({
            latestPayload,
            previousCount: (result as LikeResponse).count,
            previousStateKey: "previousLiked",
            previousStateValue: (result as LikeResponse).liked,
          })
        : null,
  });
}
