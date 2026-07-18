import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  navigateToRegisteredRoute,
  preloadRegisteredRoute,
  type RouteNavigator,
} from "../routeNavigator";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import {
  prefetchAlbumViewExperience,
  prefetchEventExperience,
  prefetchProfileExperience,
} from "../../../data/projections/prefetch/intentPrefetch";

interface ViewerIntentContext {
  id?: string | null;
  username?: string | null;
}

interface ProfileNavigationOptions {
  method?: "navigate" | "push";
}

export function useOpenProfile(navigation: RouteNavigator, viewer: ViewerIntentContext) {
  return useOpenProfileWithOptions(navigation, viewer);
}

export function useOpenProfileWithOptions(
  navigation: RouteNavigator,
  viewer: ViewerIntentContext,
  options?: ProfileNavigationOptions,
) {
  const queryClient = useQueryClient();
  const viewerKey = getViewerKey({ id: viewer.id, username: viewer.username });
  return useCallback(
    (username: string) => {
      const targetUsername = String(username || "").trim();
      if (targetUsername && viewer.username) {
        void prefetchProfileExperience({
          queryClient,
          username: targetUsername,
          viewerId: viewer.id || undefined,
          viewerKey,
          viewerUsername: String(viewer.username || "").trim(),
        }).catch(() => undefined);
      }
      preloadRegisteredRoute(navigation, "ViewProfile", { username: targetUsername || undefined });
      navigateToRegisteredRoute(
        navigation,
        "ViewProfile",
        { username: targetUsername || undefined },
        { method: options?.method },
      );
    },
    [navigation, options?.method, queryClient, viewer.id, viewer.username, viewerKey],
  );
}

export function useOpenEventDetail(navigation: RouteNavigator, viewer: ViewerIntentContext) {
  const queryClient = useQueryClient();
  const viewerKey = getViewerKey({ id: viewer.id, username: viewer.username });
  return useCallback(
    (eventId: string) => {
      const targetEventId = String(eventId || "").trim();
      if (targetEventId) {
        void prefetchEventExperience({
          eventId: targetEventId,
          queryClient,
          source: "route",
          viewerId: viewer.id || undefined,
          viewerKey,
        }).catch(() => undefined);
      }
      preloadRegisteredRoute(navigation, "EventDetail", { eventId: targetEventId || undefined });
      navigateToRegisteredRoute(navigation, "EventDetail", {
        eventId: targetEventId || undefined,
      });
    },
    [navigation, queryClient, viewer.id, viewerKey],
  );
}

export function useOpenAlbumView(navigation: RouteNavigator, viewer: ViewerIntentContext) {
  const queryClient = useQueryClient();
  const viewerKey = getViewerKey({ id: viewer.id, username: viewer.username });
  return useCallback(
    (eventId: string, options?: { photoId?: string }) => {
      const targetEventId = String(eventId || "").trim();
      const photoId = String(options?.photoId || "").trim() || undefined;
      if (targetEventId) {
        void prefetchAlbumViewExperience({
          eventId: targetEventId,
          queryClient,
          source: "route",
          viewerId: viewer.id || undefined,
          viewerKey,
        }).catch(() => undefined);
      }
      preloadRegisteredRoute(navigation, "AlbumView", {
        eventId: targetEventId || undefined,
        photoId,
      });
      navigateToRegisteredRoute(navigation, "AlbumView", {
        eventId: targetEventId || undefined,
        photoId,
      });
    },
    [navigation, queryClient, viewer.id, viewerKey],
  );
}
