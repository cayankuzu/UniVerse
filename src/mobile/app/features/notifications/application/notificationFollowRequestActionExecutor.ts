import type { MutableRefObject } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { refreshProjectionScope } from "../../../data/projections/projectionRefresh";
import {
  processFollowRequestResolutionActionQueue,
  queueFollowRequestResolutionAction,
  subscribeToFollowRequestResolutionAction,
} from "../data/followRequestActionQueue";
import {
  applyOptimisticRequestResolution,
  type OptimisticRequestContext,
  rollbackOptimisticRequestResolution,
} from "../data/notificationsRequestState";
import type { RequestAction } from "../domain/followRequestState";
import type { PushNotice, ViewerIdentity } from "./notificationFollowRequestAction.shared";
import { debugWarn } from "../../../platform/logging/logger";
import type { NotificationItem } from "../../../data/contracts/api";

interface OptimisticOutboxController {
  begin: (entry: { action: string; entity: string; id: string }) => void;
  fail: (id: string, reason: string) => void;
  resolve: (id: string) => void;
}

interface QueueNotificationFollowRequestActionParams {
  action: RequestAction;
  badgeKey: QueryKey;
  clearPendingRef: () => void;
  current: NotificationItem | null | undefined;
  followRequestSubscriptionsRef: MutableRefObject<Record<string, () => void>>;
  isMountedRef: MutableRefObject<boolean>;
  logKey: string;
  markProcessed: () => void;
  mutationLabel: string;
  notificationId: string;
  notificationsKey: QueryKey;
  optimisticOutbox: OptimisticOutboxController;
  pushNotice: PushNotice;
  queryClient: QueryClient;
  requesterIdHint?: string;
  requesterUsername: string;
  setPendingState: (action?: RequestAction) => void;
  unreadNotificationCount: number;
  userData: ViewerIdentity;
  viewerKey: string;
}

function buildFollowRequestOutboxId(notificationId: string) {
  return `follow-request:${notificationId}`;
}

function clearFollowRequestSubscription(
  subscriptionsRef: MutableRefObject<Record<string, () => void>>,
  entryId: string,
) {
  const unsubscribe = subscriptionsRef.current[entryId];
  if (!unsubscribe) return;
  unsubscribe();
  delete subscriptionsRef.current[entryId];
}

function handleFollowRequestFailure(params: {
  action: RequestAction;
  badgeKey: QueryKey;
  context?: OptimisticRequestContext;
  error: unknown;
  logKey: string;
  notificationId: string;
  notificationsKey: QueryKey;
  performRollback?: boolean;
  pushNotice: PushNotice;
  queryClient: QueryClient;
  requesterUsername: string;
  skipInvalidate?: boolean;
}) {
  debugWarn("NOTIFICATIONS/SCREEN", params.logKey, {
    action: params.action,
    message: params.error instanceof Error ? params.error.message : String(params.error),
    notificationId: params.notificationId,
    requesterUsername: params.requesterUsername,
  });
  if (params.performRollback) {
    rollbackOptimisticRequestResolution({
      badgeKey: params.badgeKey,
      context: params.context,
      notificationId: params.notificationId,
      notificationsKey: params.notificationsKey,
      qc: params.queryClient,
    });
  }
  if (!params.skipInvalidate) {
    refreshProjectionScope(params.queryClient, params.notificationsKey);
  }
  params.pushNotice("Takip isteği işlenemedi.", "error");
}

function announceFollowRequestSuccess(
  action: RequestAction,
  markProcessed: () => void,
  pushNotice: PushNotice,
) {
  markProcessed();
  pushNotice(action === "accept" ? "Takip isteği kabul edildi." : "Takip isteği reddedildi.");
}

function completeFollowRequestAction(params: {
  clearPendingRef: () => void;
  isMountedRef: MutableRefObject<boolean>;
  optimisticOutbox: OptimisticOutboxController;
  outboxId: string;
  setPendingState: (action?: RequestAction) => void;
  status: "failed" | "resolved";
}) {
  params.clearPendingRef();
  if (params.status === "failed") {
    params.optimisticOutbox.fail(params.outboxId, "follow-request-resolution-failed");
  } else {
    params.optimisticOutbox.resolve(params.outboxId);
  }
  if (!params.isMountedRef.current) {
    return false;
  }
  params.setPendingState(undefined);
  return true;
}

export async function queueNotificationFollowRequestAction(
  params: QueueNotificationFollowRequestActionParams,
) {
  const outboxId = buildFollowRequestOutboxId(params.notificationId);
  params.optimisticOutbox.begin({
    action: `follow-request-${params.action}`,
    entity: "notifications",
    id: outboxId,
  });
  const context = applyOptimisticRequestResolution({
    action: params.action,
    badgeKey: params.badgeKey,
    notificationId: params.notificationId,
    notificationsKey: params.notificationsKey,
    previousUnreadCount: params.unreadNotificationCount,
    qc: params.queryClient,
    target: params.current,
  });
  params.setPendingState(params.action);

  try {
    const entry = await queueFollowRequestResolutionAction({
      action: params.action,
      clientMutationId: createClientMutationId(params.mutationLabel),
      notificationId: params.notificationId,
      ownerId: params.userData.id,
      previousRead: context.previousRead,
      previousRequestResolvedAt: context.previousRequestResolvedAt,
      previousRequestStatus: context.previousRequestStatus,
      previousUnreadCount: context.previousUnreadCount,
      requesterIdHint: params.requesterIdHint,
      requesterUsername: params.requesterUsername,
      viewerKey: params.viewerKey,
      viewerUsername: params.userData.username,
    });

    clearFollowRequestSubscription(params.followRequestSubscriptionsRef, entry.id);
    const unsubscribe = subscribeToFollowRequestResolutionAction(entry.id, {
      onFailed: (error) => {
        clearFollowRequestSubscription(params.followRequestSubscriptionsRef, entry.id);
        if (
          !completeFollowRequestAction({
            clearPendingRef: params.clearPendingRef,
            isMountedRef: params.isMountedRef,
            optimisticOutbox: params.optimisticOutbox,
            outboxId,
            setPendingState: params.setPendingState,
            status: "failed",
          })
        ) {
          return;
        }
        handleFollowRequestFailure({
          action: params.action,
          badgeKey: params.badgeKey,
          context,
          error,
          logKey: params.logKey,
          notificationId: params.notificationId,
          notificationsKey: params.notificationsKey,
          pushNotice: params.pushNotice,
          queryClient: params.queryClient,
          requesterUsername: params.requesterUsername,
          skipInvalidate: true,
        });
      },
      onResolved: (resolvedAction) => {
        clearFollowRequestSubscription(params.followRequestSubscriptionsRef, entry.id);
        if (
          !completeFollowRequestAction({
            clearPendingRef: params.clearPendingRef,
            isMountedRef: params.isMountedRef,
            optimisticOutbox: params.optimisticOutbox,
            outboxId,
            setPendingState: params.setPendingState,
            status: "resolved",
          })
        ) {
          return;
        }
        announceFollowRequestSuccess(resolvedAction, params.markProcessed, params.pushNotice);
      },
    });
    params.followRequestSubscriptionsRef.current[entry.id] = unsubscribe;

    void processFollowRequestResolutionActionQueue({
      entryId: entry.id,
      ownerId: params.userData.id,
      queryClient: params.queryClient,
    });
  } catch (error) {
    if (
      !completeFollowRequestAction({
        clearPendingRef: params.clearPendingRef,
        isMountedRef: params.isMountedRef,
        optimisticOutbox: params.optimisticOutbox,
        outboxId,
        setPendingState: params.setPendingState,
        status: "failed",
      })
    ) {
      return;
    }
    handleFollowRequestFailure({
      action: params.action,
      badgeKey: params.badgeKey,
      context,
      error,
      logKey: params.logKey,
      notificationId: params.notificationId,
      notificationsKey: params.notificationsKey,
      performRollback: true,
      pushNotice: params.pushNotice,
      queryClient: params.queryClient,
      requesterUsername: params.requesterUsername,
    });
  }
}
