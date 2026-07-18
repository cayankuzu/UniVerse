import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import {
  buildRequestLockedMessage,
  resolveVisibleFollowRequestStateKey,
  type RequestAction,
  type RequestStatus,
  type VisibleFollowRequest,
} from "../domain/followRequestState";
import {
  normalizeFollowRequestUsername,
  resolveFollowRequestRequesterIdHint,
  type UseNotificationFollowRequestActionsParams,
} from "./notificationFollowRequestAction.shared";
import { queueNotificationFollowRequestAction } from "./notificationFollowRequestActionExecutor";
import { useFollowRequestActionStore } from "./useFollowRequestActionStore";

type FollowRequestActionStore = ReturnType<typeof useFollowRequestActionStore>;

export function useNotificationFollowRequestActions(
  params: UseNotificationFollowRequestActionsParams,
) {
  const {
    badgeKey,
    notifications,
    notificationsKey,
    pushNotice,
    unreadNotificationCount,
    userData,
    viewerKey,
  } = params;
  const queryClient = useQueryClient();
  const optimisticOutbox = useOptimisticOutboxMetaStore.getState();
  const listActions = useFollowRequestActionStore();
  const inlineActions = useFollowRequestActionStore();
  const followRequestSubscriptionsRef = useRef<Record<string, () => void>>({});
  const isMountedRef = useRef(true);
  const notificationsById = useMemo(
    () => new Map(notifications.map((item) => [item.id, item])),
    [notifications],
  );

  useEffect(
    () => () => {
      isMountedRef.current = false;
      Object.values(followRequestSubscriptionsRef.current).forEach((unsubscribe) => unsubscribe());
      followRequestSubscriptionsRef.current = {};
    },
    [],
  );

  const queueFollowRequestAction = useCallback(
    (
      requestContext: {
        current: NotificationItem | null | undefined;
        logKey: string;
        mutationLabel: string;
        notificationId: string;
        requesterIdHint?: string;
        requesterUsername: string;
        requestStatus?: RequestStatus;
        stateKey: string;
        store: FollowRequestActionStore;
      },
      action: RequestAction,
    ) => {
      const lockedState = requestContext.store.resolveLockedState(
        requestContext.stateKey,
        requestContext.requestStatus,
      );
      if (lockedState) {
        pushNotice(buildRequestLockedMessage("follow", lockedState));
        return;
      }

      requestContext.store.rememberPendingAction(requestContext.stateKey, action);
      void queueNotificationFollowRequestAction({
        action,
        badgeKey,
        clearPendingRef: () => {
          requestContext.store.clearPendingActionRef(requestContext.stateKey);
        },
        current: requestContext.current,
        followRequestSubscriptionsRef,
        isMountedRef,
        logKey: requestContext.logKey,
        markProcessed: () => {
          requestContext.store.setProcessedAction(requestContext.stateKey, action);
        },
        mutationLabel: requestContext.mutationLabel,
        notificationId: requestContext.notificationId,
        notificationsKey,
        optimisticOutbox,
        pushNotice,
        queryClient,
        requesterIdHint: requestContext.requesterIdHint,
        requesterUsername: requestContext.requesterUsername,
        setPendingState: (nextAction) =>
          requestContext.store.setPendingAction(requestContext.stateKey, nextAction),
        unreadNotificationCount,
        userData,
        viewerKey,
      });
    },
    [
      badgeKey,
      notificationsKey,
      optimisticOutbox,
      pushNotice,
      queryClient,
      unreadNotificationCount,
      userData,
      viewerKey,
    ],
  );

  const handleFollowRequestAction = useCallback(
    (item: NotificationItem, action: RequestAction) => {
      const requesterUsername = normalizeFollowRequestUsername(item.fromUsername);
      if (!requesterUsername) return;
      queueFollowRequestAction(
        {
          current: item,
          logKey: "follow-request-action-failed",
          mutationLabel: `follow-request-${action}`,
          notificationId: item.id,
          requesterIdHint: resolveFollowRequestRequesterIdHint(item.fromUserId),
          requesterUsername,
          requestStatus: item.requestStatus,
          stateKey: item.id,
          store: listActions,
        },
        action,
      );
    },
    [listActions, queueFollowRequestAction],
  );

  const handleInlineFollowRequestAction = useCallback(
    (request: VisibleFollowRequest, action: RequestAction) => {
      const requesterUsername = normalizeFollowRequestUsername(request.username);
      const requestStateKey = resolveVisibleFollowRequestStateKey(request);
      if (!requestStateKey || !requesterUsername || !request.notificationId) return;
      const current = notificationsById.get(request.notificationId);
      queueFollowRequestAction(
        {
          current,
          logKey: "inline-follow-request-action-failed",
          mutationLabel: `follow-request-inline-${action}`,
          notificationId: request.notificationId,
          requesterIdHint: resolveFollowRequestRequesterIdHint(current?.fromUserId),
          requesterUsername,
          requestStatus: request.requestStatus,
          stateKey: requestStateKey,
          store: inlineActions,
        },
        action,
      );
    },
    [inlineActions, notificationsById, queueFollowRequestAction],
  );

  return useMemo(
    () => ({
      handleFollowRequestAction,
      handleInlineFollowRequestAction,
      pendingFollowRequests: listActions.pendingActions,
      pendingInlineFollowRequests: inlineActions.pendingActions,
      processedFollowRequests: listActions.processedActions,
      processedInlineFollowRequests: inlineActions.processedActions,
    }),
    [
      handleFollowRequestAction,
      handleInlineFollowRequestAction,
      inlineActions.pendingActions,
      inlineActions.processedActions,
      listActions.pendingActions,
      listActions.processedActions,
    ],
  );
}
