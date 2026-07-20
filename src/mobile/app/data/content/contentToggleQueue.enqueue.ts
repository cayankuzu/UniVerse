import { createClientMutationId } from "../mutations/clientMutation";
import {
  enqueueMutationAction,
  upsertMutationAction,
  type MutationActionQueueKind,
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

function withoutOwnerId<T extends { ownerId?: string }>(payload: T): Omit<T, "ownerId"> {
  const { ownerId: _ownerId, ...serialized } = payload;
  void _ownerId;
  return serialized;
}

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

async function queueOrReplace<TPayload extends Record<string, unknown>>(params: {
  clientMutationIdPrefix: string;
  clientMutationId?: string | null;
  entryId: string;
  expectedKind: MutationActionQueueKind;
  extractPayload: (entry: MutationActionQueueEntry) => TPayload;
  initialPayload: TPayload;
  ownerId?: string;
  targetPatch: Record<string, unknown>;
}) {
  const clientMutationId =
    params.clientMutationId || createClientMutationId(params.clientMutationIdPrefix);
  const result = await upsertMutationAction({
    id: params.entryId,
    kind: params.expectedKind,
    ownerId: params.ownerId,
    patchExisting: (existingEntry) => ({
      attemptCount: 0,
      errorMessage: undefined,
      nextProcessAt:
        existingEntry.status === "running"
          ? (existingEntry.nextProcessAt ?? null)
          : new Date().toISOString(),
      payload: {
        ...params.extractPayload(existingEntry),
        clientMutationId,
        ...params.targetPatch,
      } as unknown as Record<string, unknown>,
      status: existingEntry.status === "running" ? "running" : "pending",
      terminalAt: null,
    }),
    payload: {
      ...params.initialPayload,
      clientMutationId,
    } as unknown as Record<string, unknown>,
  });
  return { entry: result.entry, replaced: !result.created };
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
    initialPayload: withoutOwnerId(payload),
    ownerId: payload.ownerId,
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
    initialPayload: withoutOwnerId(payload),
    ownerId: payload.ownerId,
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
    initialPayload: withoutOwnerId(payload),
    ownerId: payload.ownerId,
    targetPatch: { targetLiked: payload.targetLiked },
  });
}
