import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import {
  applyEntityPatches,
  touchProjectionQueries,
} from "../../../data/projections/patchEnvelope";
import { applyMutationRefreshPolicy } from "../../../data/projections/mutationPolicy";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { actionToRequestStatus, type RequestAction } from "../domain/followRequestState";

export type OptimisticRequestContext = {
  previousRead: boolean;
  previousRequestResolvedAt?: string;
  previousRequestStatus?: NotificationItem["requestStatus"];
  previousUnreadCount: number;
};

export function buildNotificationReadPatches(items: NotificationItem[]) {
  return items.map((item) => ({
    changes: { read: true },
    entity: "notifications",
    id: item.id,
  }));
}

export function applyOptimisticRequestResolution(params: {
  action: RequestAction;
  badgeKey: QueryKey;
  notificationId: string;
  notificationsKey: QueryKey;
  previousUnreadCount: number;
  qc: QueryClient;
  target: NotificationItem | null | undefined;
}): OptimisticRequestContext {
  const { action, badgeKey, notificationId, notificationsKey, previousUnreadCount, qc, target } =
    params;

  applyEntityPatches(qc, [
    {
      changes: {
        read: true,
        requestResolvedAt: new Date().toISOString(),
        requestStatus: actionToRequestStatus(action),
      },
      entity: "notifications",
      id: notificationId,
    },
  ]);
  touchProjectionQueries(qc, notificationsKey);
  if (target && !target.read) {
    qc.setQueryData(badgeKey, {
      id: "notifications",
      unreadCount: Math.max(0, previousUnreadCount - 1),
    });
  }

  return {
    previousRead: target?.read || false,
    previousRequestResolvedAt: target?.requestResolvedAt,
    previousRequestStatus: target?.requestStatus,
    previousUnreadCount,
  };
}

export function rollbackOptimisticRequestResolution(params: {
  badgeKey: QueryKey;
  context: OptimisticRequestContext | undefined;
  notificationId: string;
  notificationsKey: QueryKey;
  qc: QueryClient;
}) {
  const { badgeKey, context, notificationId, notificationsKey, qc } = params;

  applyEntityPatches(qc, [
    {
      changes: {
        read: Boolean(context?.previousRead),
        requestResolvedAt: context?.previousRequestResolvedAt,
        requestStatus: context?.previousRequestStatus,
      },
      entity: "notifications",
      id: notificationId,
    },
  ]);
  touchProjectionQueries(qc, notificationsKey);
  qc.setQueryData(badgeKey, {
    id: "notifications",
    unreadCount: Number(context?.previousUnreadCount || 0),
  });
}

export function applyFollowDecisionSideEffects(params: {
  badgeRefetch: () => void;
  notificationsKey: QueryKey;
  qc: QueryClient;
  requesterUsername: string;
  viewerUsername: string;
  viewerKey: string;
}) {
  const { badgeRefetch, notificationsKey, qc, requesterUsername, viewerKey, viewerUsername } =
    params;

  applyMutationRefreshPolicy(qc, {
    refreshKeys: [
      projectionKeys.profileOverview(viewerUsername, viewerKey),
      projectionKeys.profileOverview(requesterUsername, viewerKey),
      projectionKeys.relationships(viewerUsername, "followers", viewerKey),
      projectionKeys.relationships(viewerUsername, "following", viewerKey),
      projectionKeys.relationships(requesterUsername, "followers", viewerKey),
      projectionKeys.relationships(requesterUsername, "following", viewerKey),
      projectionKeys.profileContent(requesterUsername, "album", viewerKey),
      projectionKeys.profileContent(requesterUsername, "events", viewerKey),
    ],
    staleKeys: [
      projectionKeys.screen("home", viewerKey),
      projectionKeys.screen("search", "events", viewerKey),
      projectionKeys.screen("search", "albums", viewerKey),
      projectionKeys.screen("search", "clubs", viewerKey),
      projectionKeys.screen("search", "students", viewerKey),
      notificationsKey,
    ],
    touchKeys: [notificationsKey],
  });
  badgeRefetch();
}
