import { useCallback } from "react";
import { navigateToRoute } from "../navigationTargets";
import type { RootStackParamList } from "../types";
import type { RouteNavigator } from "../routeNavigator";
import { useOpenAlbumView, useOpenEventDetail, useOpenProfile } from "./useIntentNavigation";

type RootNavigation = {
  navigate: RouteNavigator["navigate"];
};

type NotificationNavigationItem = {
  eventId?: string | null;
  fromUsername?: string | null;
  photoId?: string | null;
  targetType?: string | null;
};

interface NotificationNavigationViewer {
  id?: string | null;
  username?: string | null;
}

export function useNotificationNavigation(
  navigation: RootNavigation,
  viewer: NotificationNavigationViewer,
) {
  const openAlbumView = useOpenAlbumView(navigation, viewer);
  const openEventDetail = useOpenEventDetail(navigation, viewer);
  const openProfile = useOpenProfile(navigation, viewer);

  return useCallback(
    (item: NotificationNavigationItem) => {
      const targetType = String(item.targetType || "");
      if (targetType === "profile" && item.fromUsername) {
        openProfile(item.fromUsername);
        return;
      }
      if (targetType === "album" && item.eventId) {
        openAlbumView(item.eventId, { photoId: String(item.photoId || "").trim() || undefined });
        return;
      }
      if (targetType === "event" && item.eventId) {
        openEventDetail(item.eventId);
        return;
      }
      navigateToRoute(navigation, "Home" satisfies keyof RootStackParamList);
    },
    [navigation, openAlbumView, openEventDetail, openProfile],
  );
}
