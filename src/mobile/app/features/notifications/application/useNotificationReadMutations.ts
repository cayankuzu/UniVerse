import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import type { NotificationItem } from "../../../data/contracts/api";
import {
  applyEntityPatches,
  touchProjectionQueries,
} from "../../../data/projections/patchEnvelope";
import { markAllNotificationsRead, markNotificationRead } from "../data";
import { buildNotificationReadPatches } from "../data/notificationsRequestState";

interface UseNotificationReadMutationsParams {
  badgeKey: readonly unknown[];
  navigateForNotification: (item: NotificationItem) => void;
  notifications: NotificationItem[];
  notificationsKey: readonly unknown[];
  optimisticOutbox: {
    begin: (params: { action: string; entity: string; id: string }) => void;
    fail: (id: string, reason: string) => void;
    resolve: (id: string) => void;
  };
  unreadNotificationCount: number;
  viewerKey: string;
}

function assertNotificationMutationSucceeded(
  response: { success?: boolean } | null | undefined,
  errorMessage: string,
) {
  if (!response?.success) {
    throw new Error(errorMessage);
  }
  return response;
}

export function useNotificationReadMutations(params: UseNotificationReadMutationsParams) {
  const {
    badgeKey,
    navigateForNotification,
    notifications,
    notificationsKey,
    optimisticOutbox,
    unreadNotificationCount,
    viewerKey,
  } = params;
  const qc = useQueryClient();
  const notificationOpenGateRef = useRef(new Map<string, "pending" | "ready">());

  useEffect(() => {
    const activeIds = new Set(
      notifications.map((item) => String(item.id || "").trim()).filter(Boolean),
    );
    notificationOpenGateRef.current.forEach((_state, id) => {
      if (!activeIds.has(id)) {
        notificationOpenGateRef.current.delete(id);
      }
    });
  }, [notifications]);

  const syncBadgeCache = useCallback(
    (nextUnreadCount: number) => {
      qc.setQueryData(badgeKey, {
        id: "notifications",
        unreadCount: Math.max(0, nextUnreadCount),
      });
    },
    [badgeKey, qc],
  );

  const refreshBadgeObservers = useCallback(() => {
    void qc.invalidateQueries({
      exact: true,
      queryKey: badgeKey,
      refetchType: "active",
    });
  }, [badgeKey, qc]);

  const markReadMutation = useMutation({
    mutationFn: async ({ clientMutationId }: { clientMutationId: string }) =>
      assertNotificationMutationSucceeded(
        await markAllNotificationsRead({ clientMutationId }),
        "notifications-mark-all-read-failed",
      ),
    onMutate: async () => {
      optimisticOutbox.begin({
        action: "notifications-mark-all-read",
        entity: "notifications",
        id: `notifications:mark-all-read:${viewerKey}`,
      });
      const unreadItems = notifications.filter((item) => !item.read);
      const previousUnreadCount = unreadNotificationCount;
      applyEntityPatches(qc, buildNotificationReadPatches(unreadItems));
      touchProjectionQueries(qc, notificationsKey);
      syncBadgeCache(0);
      return {
        previousReads: unreadItems.map((item) => ({ id: item.id, read: item.read })),
        previousUnreadCount,
      };
    },
    onError: (_error, _variables, context) => {
      optimisticOutbox.fail(
        `notifications:mark-all-read:${viewerKey}`,
        "notifications-mark-all-read-failed",
      );
      applyEntityPatches(
        qc,
        (context?.previousReads || []).map((item) => ({
          changes: { read: item.read },
          entity: "notifications",
          id: item.id,
        })),
      );
      touchProjectionQueries(qc, notificationsKey);
      syncBadgeCache(context?.previousUnreadCount || 0);
    },
    onSuccess: () => {
      optimisticOutbox.resolve(`notifications:mark-all-read:${viewerKey}`);
      touchProjectionQueries(qc, notificationsKey);
      refreshBadgeObservers();
    },
  });

  const markSingleReadMutation = useMutation({
    mutationFn: async ({
      clientMutationId,
      notificationId,
    }: {
      clientMutationId: string;
      notificationId: string;
    }) =>
      assertNotificationMutationSucceeded(
        await markNotificationRead(notificationId, { clientMutationId }),
        "notification-mark-read-failed",
      ),
    onMutate: async ({ notificationId }) => {
      const current = notifications.find((item) => item.id === notificationId);
      if (!current || current.read) {
        return {
          previousRead: current?.read || false,
          previousUnreadCount: unreadNotificationCount,
        };
      }
      applyEntityPatches(qc, [
        { changes: { read: true }, entity: "notifications", id: notificationId },
      ]);
      touchProjectionQueries(qc, notificationsKey);
      syncBadgeCache(Math.max(0, unreadNotificationCount - 1));
      return {
        previousRead: current.read,
        previousUnreadCount: unreadNotificationCount,
      };
    },
    onError: (_error, variables, context) => {
      applyEntityPatches(qc, [
        {
          changes: { read: Boolean(context?.previousRead) },
          entity: "notifications",
          id: variables.notificationId,
        },
      ]);
      touchProjectionQueries(qc, notificationsKey);
      syncBadgeCache(Number(context?.previousUnreadCount || 0));
    },
    onSuccess: () => {
      touchProjectionQueries(qc, notificationsKey);
      refreshBadgeObservers();
    },
  });

  const handleNotifPress = useCallback(
    async (item: NotificationItem) => {
      const notificationId = String(item.id || "").trim();
      if (!notificationId) return;
      const openGate = notificationOpenGateRef.current.get(notificationId);

      if (openGate === "pending") {
        return;
      }

      if (openGate === "ready" || item.read) {
        navigateForNotification(item);
        return;
      }

      notificationOpenGateRef.current.set(notificationId, "pending");
      // Fire-and-forget: navigate immediately instead of waiting for the
      // mark-read network round-trip to resolve first. The optimistic patch
      // (onMutate) already updates the cache as part of the mutation
      // lifecycle, so the UI is consistent regardless of navigation timing.
      const markReadSettled = markSingleReadMutation
        .mutateAsync({
          clientMutationId: createClientMutationId("notification-read"),
          notificationId,
        })
        .then(() => {
          notificationOpenGateRef.current.set(notificationId, "ready");
        })
        .catch(() => {
          notificationOpenGateRef.current.delete(notificationId);
        });
      navigateForNotification(item);
      await markReadSettled;
    },
    [markSingleReadMutation, navigateForNotification],
  );

  return {
    handleNotifPress,
    markReadMutation,
    markSingleReadMutation,
    refreshBadgeObservers,
  };
}
