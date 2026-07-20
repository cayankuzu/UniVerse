import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { supabase } from "../../platform/supabase";
import {
  scheduleProjectionSyncByEntity,
  useSyncOrchestratorStore,
} from "../../data/projections/sync/syncOrchestrator";
import { applyProjectionRealtimeEvent } from "../../data/projections/projectionRealtime";
import { logProjectionMetric } from "../../platform/observability";
import {
  bindContentRealtime,
  bindNotificationRealtime,
  bindSocialRealtime,
} from "./projectionRealtimeSubscriptions";
import {
  collectContentRealtimeScope,
  normalizeRealtimeValue,
  serializeContentRealtimeScope,
} from "./projectionRealtimeScope";
import { hydrateNotificationPresence } from "./notificationPresenceSync";

const REALTIME_EVENT_BATCH_WINDOW_MS = 32;
const REALTIME_SCOPE_REBUILD_DEBOUNCE_MS = 160;

export function useProjectionRealtimeBridgeService() {
  const queryClient = useQueryClient();
  const { isDemoMode, isLoggedIn, userData } = useAuth();
  const appStateRef = useRef(AppState.currentState);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const scopeSignatureRef = useRef("");
  const scopeRebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventIdsRef = useRef(new Set<string>());
  const pendingPhotoIdsRef = useRef(new Set<string>());
  const pendingUnreadDeltaRef = useRef(0);
  const notificationsDirtyRef = useRef(false);
  const notificationPresenceSyncPromiseRef = useRef<Promise<void> | null>(null);
  const pendingSocialProfileIdsRef = useRef(new Set<string>());
  const pendingSocialUsernamesRef = useRef(new Set<string>());
  const pendingViewerUsernameRef = useRef("");
  const viewerId = String(userData.id || "").trim();
  const viewerKey = getViewerKey(userData);
  const viewerUsername = String(userData.username || "")
    .trim()
    .toLowerCase();

  useEffect(() => {
    const pendingEventIds = pendingEventIdsRef.current;
    const pendingPhotoIds = pendingPhotoIdsRef.current;
    const pendingSocialProfileIds = pendingSocialProfileIdsRef.current;
    const pendingSocialUsernames = pendingSocialUsernamesRef.current;
    if (!isLoggedIn || isDemoMode || !viewerId) return;

    const flushRealtimeEvents = () => {
      realtimeBatchTimerRef.current = null;
      const unreadDelta = pendingUnreadDeltaRef.current;
      const eventIds = Array.from(pendingEventIdsRef.current);
      const photoIds = Array.from(pendingPhotoIdsRef.current);
      const targetProfileIds = Array.from(pendingSocialProfileIdsRef.current);
      const targetUsernames = Array.from(pendingSocialUsernamesRef.current);
      const notificationsDirty = notificationsDirtyRef.current;
      const batchedViewerUsername = pendingViewerUsernameRef.current;

      pendingUnreadDeltaRef.current = 0;
      pendingEventIds.clear();
      pendingPhotoIds.clear();
      pendingSocialProfileIds.clear();
      pendingSocialUsernames.clear();
      notificationsDirtyRef.current = false;
      pendingViewerUsernameRef.current = "";

      if (
        unreadDelta > 0 ||
        notificationsDirty ||
        eventIds.length > 0 ||
        photoIds.length > 0 ||
        targetProfileIds.length > 0 ||
        targetUsernames.length > 0
      ) {
        logProjectionMetric({
          meta: {
            batchedEventCount: eventIds.length,
            batchedNotificationDelta: unreadDelta,
            batchedPhotoCount: photoIds.length,
            batchedSocialProfileCount: targetProfileIds.length,
            batchedSocialUsernameCount: targetUsernames.length,
            notificationsDirty,
          },
          name: "realtime_batch_flush",
          screenKey: viewerKey,
          status: "ok",
        });
      }

      if (unreadDelta > 0) {
        applyProjectionRealtimeEvent({
          deferSync: appStateRef.current !== "active",
          event: {
            kind: "notifications-upsert",
            unreadDelta,
            viewerKey,
          },
          queryClient,
        });
        if (appStateRef.current === "active") {
          void syncNotificationPresence("realtime-event");
        }
      } else if (notificationsDirty) {
        applyProjectionRealtimeEvent({
          deferSync: appStateRef.current !== "active",
          event: {
            kind: "notifications-updated",
            viewerKey,
          },
          queryClient,
        });
        if (appStateRef.current === "active") {
          void syncNotificationPresence("realtime-event");
        }
      }

      if (targetProfileIds.length > 0 || targetUsernames.length > 0 || batchedViewerUsername) {
        applyProjectionRealtimeEvent({
          deferSync: appStateRef.current !== "active",
          event: {
            kind: "profile-social-changed",
            targetProfileIds,
            targetUsernames,
            viewerKey,
            viewerUsername: batchedViewerUsername || viewerUsername,
          },
          queryClient,
        });
      }

      if (eventIds.length > 0 || photoIds.length > 0) {
        applyProjectionRealtimeEvent({
          deferSync: appStateRef.current !== "active",
          event: {
            eventIds,
            kind: "content-engagement-changed",
            photoIds,
            viewerKey,
          },
          queryClient,
        });
      }
    };

    const scheduleRealtimeFlush = () => {
      if (realtimeBatchTimerRef.current) return;
      realtimeBatchTimerRef.current = setTimeout(
        flushRealtimeEvents,
        REALTIME_EVENT_BATCH_WINDOW_MS,
      );
    };

    const dispatchRealtimeEvent = (
      event: Parameters<typeof applyProjectionRealtimeEvent>[0]["event"],
    ) => {
      if (event.kind === "content-engagement-changed") {
        (event.eventIds || []).forEach((eventId) => {
          const normalized = normalizeRealtimeValue(eventId);
          if (normalized) pendingEventIdsRef.current.add(normalized);
        });
        (event.photoIds || []).forEach((photoId) => {
          const normalized = normalizeRealtimeValue(photoId);
          if (normalized) pendingPhotoIdsRef.current.add(normalized);
        });
        scheduleRealtimeFlush();
        return;
      }

      if (event.kind === "notifications-upsert") {
        pendingUnreadDeltaRef.current += Math.max(0, Number(event.unreadDelta || 0));
        notificationsDirtyRef.current = true;
        scheduleRealtimeFlush();
        return;
      }

      if (event.kind === "notifications-updated") {
        notificationsDirtyRef.current = true;
        scheduleRealtimeFlush();
        return;
      }

      (event.targetProfileIds || []).forEach((profileId) => {
        const normalized = normalizeRealtimeValue(profileId);
        if (normalized) pendingSocialProfileIdsRef.current.add(normalized);
      });
      (event.targetUsernames || []).forEach((username) => {
        const normalized = normalizeRealtimeValue(username);
        if (normalized) pendingSocialUsernamesRef.current.add(normalized);
      });
      pendingViewerUsernameRef.current = normalizeRealtimeValue(
        event.viewerUsername || pendingViewerUsernameRef.current || viewerUsername,
      );
      scheduleRealtimeFlush();
    };

    const syncNotificationPresence = (reason: string) => {
      if (notificationPresenceSyncPromiseRef.current) {
        return notificationPresenceSyncPromiseRef.current;
      }
      const syncTask: Promise<void> = hydrateNotificationPresence({
        queryClient,
        reason,
        viewerId,
        viewerKey,
      }).then(() => undefined);
      const clearCompletedTask = () => {
        if (notificationPresenceSyncPromiseRef.current === syncTask) {
          notificationPresenceSyncPromiseRef.current = null;
        }
      };

      notificationPresenceSyncPromiseRef.current = syncTask;
      void syncTask.then(clearCompletedTask, clearCompletedTask);
      return syncTask;
    };

    const mountRealtimeChannel = (scope = collectContentRealtimeScope()) => {
      const channel = supabase.channel(
        `projection-realtime:${viewerKey}:${serializeContentRealtimeScope(scope)}`,
      );
      bindNotificationRealtime(channel, {
        dispatch: dispatchRealtimeEvent,
        viewerId,
        viewerKey,
      });
      bindSocialRealtime(channel, {
        dispatch: dispatchRealtimeEvent,
        onBlockRelationChanged: () => invalidateBlockedVisibilityLocally(),
        viewerId,
        viewerKey,
        viewerUsername,
      });
      bindContentRealtime(channel, {
        dispatch: dispatchRealtimeEvent,
        eventIds: scope.eventIds,
        photoIds: scope.photoIds,
        viewerKey,
      });
      channelRef.current = channel;
      scopeSignatureRef.current = serializeContentRealtimeScope(scope);
      logProjectionMetric({
        meta: {
          eventScopeCount: scope.eventIds.length,
          photoScopeCount: scope.photoIds.length,
        },
        name: "realtime_scope_size",
        screenKey: viewerKey,
        status: "ok",
      });
      void channel.subscribe();
    };

    const rebuildRealtimeChannel = () => {
      const nextScope = collectContentRealtimeScope();
      const nextSignature = serializeContentRealtimeScope(nextScope);
      if (nextSignature === scopeSignatureRef.current) return;
      const previousChannel = channelRef.current;
      mountRealtimeChannel(nextScope);
      if (previousChannel) {
        void supabase.removeChannel(previousChannel);
      }
    };

    const scheduleRealtimeScopeRebuild = () => {
      if (scopeRebuildTimerRef.current) return;
      scopeRebuildTimerRef.current = setTimeout(() => {
        scopeRebuildTimerRef.current = null;
        rebuildRealtimeChannel();
      }, REALTIME_SCOPE_REBUILD_DEBOUNCE_MS);
    };

    const invalidateBlockedVisibilityLocally = () => {
      applyProjectionRealtimeEvent({
        deferSync: appStateRef.current !== "active",
        event: {
          kind: "profile-social-changed",
          targetProfileIds: [],
          targetUsernames: [],
          viewerKey,
          viewerUsername,
        },
        queryClient,
      });
    };

    mountRealtimeChannel();
    void syncNotificationPresence("realtime-mount");

    const unsubscribeSyncStore = useSyncOrchestratorStore.subscribe((state, previousState) => {
      if (state.projections === previousState.projections) return;
      scheduleRealtimeScopeRebuild();
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") {
        flushRealtimeEvents();
        applyProjectionRealtimeEvent({
          deferSync: false,
          event: {
            kind: "notifications-updated",
            viewerKey,
          },
          queryClient,
        });
        scheduleProjectionSyncByEntity(["home-feed", "notifications"], 120);
        void syncNotificationPresence("foreground");
      }
    });

    return () => {
      if (scopeRebuildTimerRef.current) {
        clearTimeout(scopeRebuildTimerRef.current);
        scopeRebuildTimerRef.current = null;
      }
      if (realtimeBatchTimerRef.current) {
        clearTimeout(realtimeBatchTimerRef.current);
        realtimeBatchTimerRef.current = null;
      }
      pendingEventIds.clear();
      pendingPhotoIds.clear();
      pendingSocialProfileIds.clear();
      pendingSocialUsernames.clear();
      pendingUnreadDeltaRef.current = 0;
      notificationsDirtyRef.current = false;
      notificationPresenceSyncPromiseRef.current = null;
      pendingViewerUsernameRef.current = "";
      unsubscribeSyncStore();
      subscription.remove();
      const channel = channelRef.current;
      channelRef.current = null;
      scopeSignatureRef.current = "";
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isDemoMode, isLoggedIn, queryClient, viewerId, viewerKey, viewerUsername]);
}
