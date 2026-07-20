import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { FollowAPI } from "../../../data/social";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import {
  getMutationActionEntry,
  processMutationActionQueue,
  subscribeMutationAction,
  type MutationActionQueueEntry,
  upsertMutationAction,
} from "../../../data/queues/mutationActionQueue";
import {
  commitProfileFollowMutation,
  rollbackProfileFollowMutation,
} from "../data/profileFollowMutationPolicy";

type FollowState = "none" | "requested" | "following";
type TargetAccountType = "club" | "student";

interface SerializedRelationshipTarget {
  id: string;
  listKey: QueryKey;
  removeOnNone?: boolean;
}

interface SerializedFollowPayload {
  clientMutationId?: string | null;
  outboxFailReason?: string;
  outboxId?: string;
  previousStatus: FollowState;
  relationship?: SerializedRelationshipTarget;
  targetProfile?: {
    accountType?: TargetAccountType | null;
    isPrivate?: boolean | null;
  };
  targetStatus: FollowState;
  targetUserId?: string | null;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}

function getFollowPayload(entry: MutationActionQueueEntry): SerializedFollowPayload {
  return entry.payload as unknown as SerializedFollowPayload;
}

export function buildFollowActionQueueEntryId(username: string) {
  return `follow:${String(username || "")
    .trim()
    .toLowerCase()}`;
}

export async function queueFollowAction(payload: SerializedFollowPayload & { ownerId?: string }) {
  const { ownerId, ...serializedPayload } = payload;
  const clientMutationId =
    serializedPayload.clientMutationId || createClientMutationId("follow-toggle");
  const result = await upsertMutationAction({
    id: serializedPayload.outboxId || buildFollowActionQueueEntryId(serializedPayload.username),
    kind: "follow-toggle",
    ownerId,
    patchExisting: (entry) => {
      const currentPayload = getFollowPayload(entry);
      return {
        attemptCount: 0,
        errorMessage: undefined,
        nextProcessAt:
          entry.status === "running" ? (entry.nextProcessAt ?? null) : new Date().toISOString(),
        payload: {
          ...serializedPayload,
          clientMutationId,
          previousStatus: currentPayload.previousStatus,
        } as unknown as Record<string, unknown>,
        status: entry.status === "running" ? "running" : "pending",
        terminalAt: null,
      };
    },
    payload: {
      ...serializedPayload,
      clientMutationId,
    } as unknown as Record<string, unknown>,
  });
  return result.entry;
}

export function subscribeToFollowAction(
  entryId: string,
  params: {
    onFailed?: (details: {
      previousStatus: FollowState;
      rolledBackFromStatus: FollowState;
    }) => void;
    onResolved?: (status: FollowState) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    const payload = getFollowPayload(event.entry);
    if (event.status === "resolved") {
      params.onResolved?.(
        (event.result as { status?: FollowState } | undefined)?.status || payload.targetStatus,
      );
      return;
    }
    params.onFailed?.({
      previousStatus: payload.previousStatus,
      rolledBackFromStatus: payload.targetStatus,
    });
  });
}

export async function processFollowActionQueue(params: {
  entryId?: string;
  ownerId?: string;
  queryClient: QueryClient;
}) {
  await processMutationActionQueue({
    entryId: params.entryId,
    handler: async (entry) => {
      const payload = getFollowPayload(entry);
      return FollowAPI.toggle(payload.username, {
        clientMutationId: payload.clientMutationId || createClientMutationId("follow-toggle"),
        desiredStatus: payload.targetStatus,
        previousStatusHint: payload.previousStatus,
        targetIsPrivate: payload.targetProfile?.isPrivate,
        targetUserId: payload.targetUserId || undefined,
      });
    },
    kind: "follow-toggle",
    onResolved: async (entry, result) => {
      const payload = getFollowPayload(entry);
      const latestEntry = await getMutationActionEntry(entry.id);
      const latestPayload = latestEntry ? getFollowPayload(latestEntry) : payload;
      if (
        latestEntry &&
        latestEntry.status === "running" &&
        latestPayload.targetStatus !== payload.targetStatus
      ) {
        return {
          attemptCount: 0,
          errorMessage: undefined,
          nextProcessAt: new Date().toISOString(),
          payload: {
            ...latestPayload,
            previousStatus: result.status,
          } as unknown as Record<string, unknown>,
          status: "pending" as const,
        };
      }
      if (payload.outboxId) {
        useOptimisticOutboxMetaStore.getState().resolve(payload.outboxId);
      }
      commitProfileFollowMutation({
        nextStatus: result.status,
        previousStatus: payload.previousStatus,
        queryClient: params.queryClient,
        relationship: payload.relationship,
        targetProfile: payload.targetProfile,
        username: payload.username,
        viewerCacheKey: payload.viewerCacheKey,
        viewerUsername: payload.viewerUsername,
      });
      return null;
    },
    onFailed: (entry) => {
      const payload = getFollowPayload(entry);
      if (payload.outboxId) {
        useOptimisticOutboxMetaStore.getState().fail(payload.outboxId, payload.outboxFailReason);
      }
      rollbackProfileFollowMutation({
        previousStatus: payload.previousStatus,
        queryClient: params.queryClient,
        relationship: payload.relationship,
        rolledBackFromStatus: payload.targetStatus,
        targetProfile: payload.targetProfile,
        username: payload.username,
        viewerCacheKey: payload.viewerCacheKey,
        viewerUsername: payload.viewerUsername,
      });
    },
    ownerId: params.ownerId,
  });
}
