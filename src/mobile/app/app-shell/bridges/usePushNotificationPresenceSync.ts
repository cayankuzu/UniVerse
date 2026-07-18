import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { resolvePushPlatform } from "../../platform/notifications/pushRuntime";
import {
  isForegroundPushMirrorNotification,
  maybePresentForegroundPushNotification,
} from "./foregroundPushMirror";
import { hydrateNotificationPresence } from "./notificationPresenceSync";

const PUSH_NOTIFICATION_SYNC_DEBOUNCE_MS = 180;

export function usePushNotificationPresenceSync() {
  const queryClient = useQueryClient();
  const { isDemoMode, isLoggedIn, userData } = useAuth();
  const lastSyncAtRef = useRef(0);
  const pendingSyncPromiseRef = useRef<Promise<void> | null>(null);
  const viewerId = String(userData.id || "").trim();
  const viewerKey = getViewerKey(userData);

  useEffect(() => {
    if (isLoggedIn && viewerId) return;
    lastSyncAtRef.current = 0;
    pendingSyncPromiseRef.current = null;
  }, [isLoggedIn, viewerId]);

  useEffect(() => {
    if (!isLoggedIn || isDemoMode || !viewerId || !resolvePushPlatform()) {
      return;
    }

    let disposed = false;

    const requestPresenceSync = (reason: string) => {
      if (disposed) return Promise.resolve();
      if (pendingSyncPromiseRef.current) {
        return pendingSyncPromiseRef.current;
      }
      const now = Date.now();
      if (now - lastSyncAtRef.current < PUSH_NOTIFICATION_SYNC_DEBOUNCE_MS) {
        return Promise.resolve();
      }

      const syncTask = (async () => {
        const result = await hydrateNotificationPresence({
          hydrateListWhenMissing: true,
          queryClient,
          reason,
          viewerId,
          viewerKey,
        });
        if (result) {
          lastSyncAtRef.current = Date.now();
        }
      })().finally(() => {
        pendingSyncPromiseRef.current = null;
      });

      pendingSyncPromiseRef.current = syncTask;
      return syncTask;
    };

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (disposed || !response?.notification) return;
        void requestPresenceSync("push-launch-response");
      })
      .catch(() => undefined);

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      if (isForegroundPushMirrorNotification(notification)) {
        return;
      }
      void maybePresentForegroundPushNotification({
        appState: AppState.currentState,
        notification,
      }).catch(() => undefined);
      void requestPresenceSync("push-received");
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
      void requestPresenceSync("push-response");
    });

    return () => {
      disposed = true;
      receivedSubscription.remove();
      responseSubscription.remove();
      pendingSyncPromiseRef.current = null;
    };
  }, [isDemoMode, isLoggedIn, queryClient, viewerId, viewerKey]);
}
