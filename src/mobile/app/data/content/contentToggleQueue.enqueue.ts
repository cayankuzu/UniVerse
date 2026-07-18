import { createClientMutationId } from "../mutations/clientMutation";
import {
  enqueueMutationAction,
  getMutationActionEntry,
  patchMutationActionEntry,
  type MutationActionQueueEntry,
} from "../queues/mutationActionQueue";
import {
  buildAlbumLikeQueueEntryId,
  buildEventAttendanceQueueEntryId,
  buildEventLikeQueueEntryId,
  type AlbumLikeTogglePayload,
  type EventAttendanceTogglePayload,
  type EventLikeTogglePayload,
} from "./contentToggleQueue.shared";
import {
  assertAlbumInteractionAllowed,
  assertEventInteractionAllowed,
} from "../social/blockedInteractionGuard";

export async function queueEventLikeToggleAction(
  payload: EventLikeTogglePayload & { ownerId?: string },
) {
  await assertEventInteractionAllowed({
    eventId: payload.eventId,
    viewerIdHint: payload.ownerId,
  });
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildEventLikeQueueEntryId(payload.eventId),
    kind: "event-like-toggle",
    ownerId,
    payload: {
      clientMutationId: payload.clientMutationId || createClientMutationId("event-like"),
      ...serializedPayload,
    } as unknown as Record<string, unknown>,
  });
}

export async function queueEventAttendanceToggleAction(
  payload: EventAttendanceTogglePayload & { ownerId?: string },
) {
  await assertEventInteractionAllowed({
    eventId: payload.eventId,
    viewerIdHint: payload.ownerId,
  });
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildEventAttendanceQueueEntryId(payload.eventId),
    kind: "event-attendance-toggle",
    ownerId,
    payload: {
      clientMutationId: payload.clientMutationId || createClientMutationId("event-attend"),
      ...serializedPayload,
    } as unknown as Record<string, unknown>,
  });
}

export async function queueAlbumLikeToggleAction(
  payload: AlbumLikeTogglePayload & { ownerId?: string },
) {
  await assertAlbumInteractionAllowed({
    photoId: payload.photoId,
    viewerIdHint: payload.ownerId,
  });
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildAlbumLikeQueueEntryId(payload.photoId),
    kind: "album-like-toggle",
    ownerId,
    payload: {
      clientMutationId: payload.clientMutationId || createClientMutationId("album-like"),
      ...serializedPayload,
    } as unknown as Record<string, unknown>,
  });
}

// Generic queueOrReplace: patches an existing entry if it matches the expected kind,
// otherwise enqueues a fresh one.
async function queueOrReplace<TPayload extends Record<string, unknown>>(params: {
  clientMutationIdPrefix: string;
  clientMutationId?: string | null;
  entryId: string;
  expectedKind: string;
  extractPayload: (entry: MutationActionQueueEntry) => TPayload;
  fallback: () => Promise<MutationActionQueueEntry>;
  targetPatch: Record<string, unknown>;
}) {
  const existingEntry = await getMutationActionEntry(params.entryId);
  if (existingEntry?.kind === params.expectedKind) {
    const existingPayload = params.extractPayload(existingEntry);
    const nextEntry = await patchMutationActionEntry(params.entryId, {
      attemptCount: 0,
      errorMessage: undefined,
      nextProcessAt:
        existingEntry.status === "running"
          ? (existingEntry.nextProcessAt ?? null)
          : new Date().toISOString(),
      payload: {
        ...existingPayload,
        clientMutationId:
          params.clientMutationId || createClientMutationId(params.clientMutationIdPrefix),
        ...params.targetPatch,
      } as unknown as Record<string, unknown>,
      status: existingEntry.status === "running" ? "running" : "pending",
    });
    if (nextEntry) {
      return { entry: nextEntry, replaced: true };
    }
  }
  return { entry: await params.fallback(), replaced: false };
}

export async function queueOrReplaceEventLikeToggleAction(
  payload: EventLikeTogglePayload & { ownerId?: string },
) {
  await assertEventInteractionAllowed({
    eventId: payload.eventId,
    viewerIdHint: payload.ownerId,
  });
  return queueOrReplace({
    clientMutationId: payload.clientMutationId,
    clientMutationIdPrefix: "event-like",
    entryId: buildEventLikeQueueEntryId(payload.eventId),
    expectedKind: "event-like-toggle",
    extractPayload: (e) => e.payload as unknown as EventLikeTogglePayload,
    fallback: () => queueEventLikeToggleAction(payload),
    targetPatch: { targetLiked: payload.targetLiked },
  });
}

export async function queueOrReplaceEventAttendanceToggleAction(
  payload: EventAttendanceTogglePayload & { ownerId?: string },
) {
  await assertEventInteractionAllowed({
    eventId: payload.eventId,
    viewerIdHint: payload.ownerId,
  });
  return queueOrReplace({
    clientMutationId: payload.clientMutationId,
    clientMutationIdPrefix: "event-attend",
    entryId: buildEventAttendanceQueueEntryId(payload.eventId),
    expectedKind: "event-attendance-toggle",
    extractPayload: (e) => e.payload as unknown as EventAttendanceTogglePayload,
    fallback: () => queueEventAttendanceToggleAction(payload),
    targetPatch: { targetJoined: payload.targetJoined },
  });
}

export async function queueOrReplaceAlbumLikeToggleAction(
  payload: AlbumLikeTogglePayload & { ownerId?: string },
) {
  await assertAlbumInteractionAllowed({
    photoId: payload.photoId,
    viewerIdHint: payload.ownerId,
  });
  return queueOrReplace({
    clientMutationId: payload.clientMutationId,
    clientMutationIdPrefix: "album-like",
    entryId: buildAlbumLikeQueueEntryId(payload.photoId),
    expectedKind: "album-like-toggle",
    extractPayload: (e) => e.payload as unknown as AlbumLikeTogglePayload,
    fallback: () => queueAlbumLikeToggleAction(payload),
    targetPatch: { targetLiked: payload.targetLiked },
  });
}
