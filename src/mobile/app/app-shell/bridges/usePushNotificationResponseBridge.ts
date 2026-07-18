import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { markNotificationReadRequest } from "../../data/notifications/notificationsApi.mutations";
import { getNotificationById } from "../../data/notifications/notificationsProjectionApi";
import { createClientMutationId } from "../../data/mutations/clientMutation";
import type { NotificationItem } from "../../data/contracts/api";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { applyEntityPatches, touchProjectionQueries } from "../../data/projections/patchEnvelope";
import { projectionKeys } from "../../data/projections/projectionKeys";
import { resolvePushPlatform } from "../../platform/notifications/pushRuntime";
import { useAuth } from "../auth";
import { navigateToRoute } from "../navigation/navigationTargets";
import type { RouteNavigator } from "../navigation/routeNavigator";
import {
  buildPushNotificationNavigationTarget,
  buildPushNotificationResponseHandlingKey,
  canNavigatePushNotificationTarget,
  parsePushNotificationPayload,
  type PushNotificationNavigationTarget,
} from "./pushNotificationResponse.shared";

type RootNavigationRef = RouteNavigator & {
  isReady?: () => boolean;
};

function navigateForPushTarget(
  navigationRef: RootNavigationRef,
  target: NotificationItem | PushNotificationNavigationTarget,
) {
  const targetType = String(target.targetType || "").trim();
  const eventId = String(target.eventId || "").trim();
  const fromUsername = String(target.fromUsername || "").trim();
  const photoId = String(target.photoId || "").trim();

  if (targetType === "profile" && fromUsername) {
    navigateToRoute(navigationRef, "ViewProfile", {
      username: fromUsername || undefined,
    });
    return;
  }

  if (targetType === "album" && eventId) {
    navigateToRoute(navigationRef, "AlbumView", {
      eventId: eventId || undefined,
      photoId: photoId || undefined,
    });
    return;
  }

  if (targetType === "event" && eventId) {
    navigateToRoute(navigationRef, "EventDetail", {
      eventId: eventId || undefined,
    });
    return;
  }

  navigateToRoute(navigationRef, "Notifications");
}

function getEntityNotification(
  queryClient: ReturnType<typeof useQueryClient>,
  notificationId: string,
) {
  const id = String(notificationId || "").trim();
  if (!id) return null;
  return (
    queryClient.getQueryData<NotificationItem>(projectionKeys.entity("notifications", id)) || null
  );
}

async function clearLastNotificationResponse() {
  const notificationsModule = Notifications as typeof Notifications & {
    clearLastNotificationResponseAsync?: () => Promise<void>;
  };
  await notificationsModule.clearLastNotificationResponseAsync?.();
}

async function resolveNotificationTarget(params: {
  fallbackTarget: PushNotificationNavigationTarget | null;
  notificationId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  viewerId: string;
}) {
  const { fallbackTarget, notificationId, queryClient, viewerId } = params;
  const cachedItem = getEntityNotification(queryClient, notificationId);
  if (canNavigatePushNotificationTarget(cachedItem || null)) {
    return cachedItem;
  }

  const fetchedItem = await getNotificationById(notificationId, viewerId).catch(() => null);
  if (fetchedItem) {
    queryClient.setQueryData(projectionKeys.entity("notifications", notificationId), fetchedItem);
    return fetchedItem;
  }

  return fallbackTarget;
}

async function markNotificationReadFromPush(params: {
  notificationId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  resolvedItem: NotificationItem | PushNotificationNavigationTarget | null;
  viewerKey: string;
}) {
  const { notificationId, queryClient, resolvedItem, viewerKey } = params;
  const id = String(notificationId || "").trim();
  if (!id) return;

  const notificationsKey = projectionKeys.notifications(viewerKey, "all");
  const badgeKey = projectionKeys.notificationBadge(viewerKey);
  const entityItem = getEntityNotification(queryClient, id);
  const currentItem =
    entityItem || (resolvedItem && "createdAt" in resolvedItem ? resolvedItem : null);
  const wasUnread = Boolean(currentItem && !currentItem.read);
  const previousBadge = queryClient.getQueryData<{ id?: string; unreadCount?: number }>(badgeKey);

  if (wasUnread) {
    applyEntityPatches(queryClient, [{ changes: { read: true }, entity: "notifications", id }]);
    touchProjectionQueries(queryClient, notificationsKey);
    if (previousBadge && typeof previousBadge === "object") {
      queryClient.setQueryData(badgeKey, {
        ...previousBadge,
        id: previousBadge.id || "notifications",
        unreadCount: Math.max(0, Number(previousBadge.unreadCount || 0) - 1),
      });
    }
  }

  try {
    const response = await markNotificationReadRequest(id, {
      clientMutationId: createClientMutationId("push-notification-read"),
    });
    if (!response.success) {
      throw new Error("push-notification-read-failed");
    }
  } catch {
    if (!wasUnread) return;
    applyEntityPatches(queryClient, [{ changes: { read: false }, entity: "notifications", id }]);
    touchProjectionQueries(queryClient, notificationsKey);
    if (previousBadge && typeof previousBadge === "object") {
      queryClient.setQueryData(badgeKey, previousBadge);
    }
  }
}

export function usePushNotificationResponseBridge(params: {
  navigationReady: boolean;
  navigationRef: RootNavigationRef;
}) {
  const { navigationReady, navigationRef } = params;
  const queryClient = useQueryClient();
  const { isDemoMode, isLoggedIn, userData } = useAuth();
  const viewerId = String(userData.id || "").trim();
  const viewerKey = getViewerKey(userData);
  const handledResponseKeyRef = useRef<string>("");
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const activeHandlingKeyRef = useRef<string>("");

  useEffect(() => {
    if (isLoggedIn && viewerId) return;
    handledResponseKeyRef.current = "";
    pendingResponseRef.current = null;
    activeHandlingKeyRef.current = "";
  }, [isLoggedIn, viewerId]);

  useEffect(() => {
    if (!isLoggedIn || isDemoMode || !viewerId || !resolvePushPlatform()) {
      return;
    }

    let disposed = false;

    const processResponse = async (
      response: Notifications.NotificationResponse | null | undefined,
      reason: string,
    ) => {
      const handlingKey = buildPushNotificationResponseHandlingKey(response);
      if (!response?.notification || !handlingKey) return;
      if (
        handlingKey === handledResponseKeyRef.current ||
        handlingKey === activeHandlingKeyRef.current
      ) {
        return;
      }
      if (!navigationReady || navigationRef.isReady?.() === false) {
        pendingResponseRef.current = response;
        return;
      }

      activeHandlingKeyRef.current = handlingKey;
      pendingResponseRef.current = null;

      try {
        const payload = parsePushNotificationPayload(response);
        const notificationId = String(payload.notificationId || "").trim();
        const fallbackTarget = buildPushNotificationNavigationTarget(payload);
        const cachedTarget = getEntityNotification(queryClient, notificationId);
        const immediateTarget = canNavigatePushNotificationTarget(cachedTarget || null)
          ? cachedTarget
          : canNavigatePushNotificationTarget(fallbackTarget)
            ? fallbackTarget
            : null;
        const resolvedTargetPromise = notificationId
          ? resolveNotificationTarget({
              fallbackTarget,
              notificationId,
              queryClient,
              viewerId,
            })
          : Promise.resolve(fallbackTarget);

        if (immediateTarget) {
          navigateForPushTarget(navigationRef, immediateTarget);
        } else {
          const resolvedTarget = await resolvedTargetPromise;
          if (disposed) return;
          if (resolvedTarget && canNavigatePushNotificationTarget(resolvedTarget)) {
            navigateForPushTarget(navigationRef, resolvedTarget);
          } else {
            navigateToRoute(navigationRef, "Notifications");
          }
        }

        void resolvedTargetPromise
          .then((resolvedTarget) =>
            markNotificationReadFromPush({
              notificationId,
              queryClient,
              resolvedItem: resolvedTarget,
              viewerKey,
            }),
          )
          .catch(() => undefined);
        handledResponseKeyRef.current = handlingKey;
        await clearLastNotificationResponse().catch(() => undefined);
      } finally {
        activeHandlingKeyRef.current = "";
        if (!disposed && pendingResponseRef.current) {
          void processResponse(pendingResponseRef.current, `${reason}-pending`);
        }
      }
    };

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (disposed) return;
        void processResponse(response, "push-launch-response");
      })
      .catch(() => undefined);

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void processResponse(response, "push-response");
      },
    );

    return () => {
      disposed = true;
      responseSubscription.remove();
      activeHandlingKeyRef.current = "";
    };
  }, [isDemoMode, isLoggedIn, navigationReady, navigationRef, queryClient, viewerId, viewerKey]);
}
