import type { QueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { FollowAPI } from "../../../data/social";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  enqueueMutationAction,
  processMutationActionQueue,
  subscribeMutationAction,
  type MutationActionQueueEntry,
} from "../../../data/queues/mutationActionQueue";
import { refreshProjectionScope } from "../../../data/projections/projectionRefresh";
import {
  applyFollowDecisionSideEffects,
  rollbackOptimisticRequestResolution,
} from "./notificationsRequestState";
import type { RequestAction } from "../domain/followRequestState";

export interface FollowRequestResolutionPayload {
  action: RequestAction;
  clientMutationId?: string | null;
  notificationId: string;
  previousRead: boolean;
  previousRequestResolvedAt?: string;
  previousRequestStatus?: NotificationItem["requestStatus"];
  previousUnreadCount: number;
  requesterIdHint?: string;
  requesterUsername: string;
  viewerKey: string;
  viewerUsername: string;
}

function getFollowRequestPayload(entry: MutationActionQueueEntry) {
  return entry.payload as unknown as FollowRequestResolutionPayload;
}

export function buildFollowRequestResolutionQueueEntryId(notificationId: string) {
  return `follow-request:${String(notificationId || "")
    .trim()
    .toLowerCase()}`;
}

export async function queueFollowRequestResolutionAction(
  payload: FollowRequestResolutionPayload & { ownerId?: string },
) {
  const { ownerId, ...serializedPayload } = payload;
  return enqueueMutationAction({
    id: buildFollowRequestResolutionQueueEntryId(payload.notificationId),
    kind: "follow-request-resolution",
    ownerId,
    payload: {
      ...serializedPayload,
      clientMutationId:
        serializedPayload.clientMutationId ||
        createClientMutationId(`follow-request-${serializedPayload.action}`),
    } as unknown as Record<string, unknown>,
  });
}

export function subscribeToFollowRequestResolutionAction(
  entryId: string,
  params: {
    onFailed?: (error?: unknown) => void;
    onResolved?: (action: RequestAction) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    const payload = getFollowRequestPayload(event.entry);
    if (event.status === "resolved") {
      params.onResolved?.(payload.action);
      return;
    }
    params.onFailed?.(event.error);
  });
}

export async function processFollowRequestResolutionActionQueue(params: {
  entryId?: string;
  ownerId?: string;
  queryClient: QueryClient;
}) {
  await processMutationActionQueue({
    entryId: params.entryId,
    handler: async (entry) => {
      const payload = getFollowRequestPayload(entry);
      const requesterIdHint = String(payload.requesterIdHint || "").trim() || undefined;
      const result =
        payload.action === "accept"
          ? await FollowAPI.acceptRequest(payload.requesterUsername, {
              clientMutationId: payload.clientMutationId || undefined,
              notificationIdHint: payload.notificationId,
              requesterIdHint,
            })
          : await FollowAPI.rejectRequest(payload.requesterUsername, {
              clientMutationId: payload.clientMutationId || undefined,
              requesterIdHint,
            });
      if (!result.success) {
        throw new Error(`follow-request-${payload.action}-not-persisted`);
      }
      return result;
    },
    kind: "follow-request-resolution",
    onResolved: async (entry) => {
      const payload = getFollowRequestPayload(entry);
      const notificationsKey = projectionKeys.notifications(payload.viewerKey, "all");
      applyFollowDecisionSideEffects({
        badgeRefetch: () => {
          void params.queryClient.invalidateQueries({
            exact: true,
            queryKey: projectionKeys.notificationBadge(payload.viewerKey),
            refetchType: "active",
          });
        },
        notificationsKey,
        qc: params.queryClient,
        requesterUsername: payload.requesterUsername,
        viewerKey: payload.viewerKey,
        viewerUsername: payload.viewerUsername,
      });
      return null;
    },
    onFailed: async (entry) => {
      const payload = getFollowRequestPayload(entry);
      const notificationsKey = projectionKeys.notifications(payload.viewerKey, "all");
      rollbackOptimisticRequestResolution({
        badgeKey: projectionKeys.notificationBadge(payload.viewerKey),
        context: {
          previousRead: payload.previousRead,
          previousRequestResolvedAt: payload.previousRequestResolvedAt,
          previousRequestStatus: payload.previousRequestStatus,
          previousUnreadCount: payload.previousUnreadCount,
        },
        notificationId: payload.notificationId,
        notificationsKey,
        qc: params.queryClient,
      });
      refreshProjectionScope(params.queryClient, notificationsKey);
    },
    ownerId: params.ownerId,
  });
}
