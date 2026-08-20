import { useCallback, useState } from "react";
import {
  useOpenAlbumView,
  useOpenEventDetail,
  useOpenProfile,
} from "../../../app-shell/navigation/hooks/useIntentNavigation";
import {
  navigateToRegisteredRoute,
  type RouteNavigator,
} from "../../../app-shell/navigation/routeNavigator";
import type {
  AlbumPhotoWithMeta,
  AuthUserData,
  EventWithMeta,
  RelationSnapshot,
} from "../../../features/content-cards/public/types";
import { requestNotificationPermissionFromUserInteraction } from "../application/notificationPermissionAction";

export type HomeFeedOverlayState =
  | {
      kind: "event";
      panel: "attendees" | "comments" | "likes" | "location";
      event: EventWithMeta;
      relations?: RelationSnapshot;
    }
  | {
      kind: "album";
      panel: "comments" | "likes";
      photo: AlbumPhotoWithMeta;
      relations?: RelationSnapshot;
    }
  | null;

export function useHomeScreenActions(params: {
  navigation: RouteNavigator;
  userData: AuthUserData;
}) {
  const [activeOverlay, setActiveOverlay] = useState<HomeFeedOverlayState>(null);
  const openProfile = useOpenProfile(params.navigation, params.userData);
  const openEventFromAlbum = useOpenEventDetail(params.navigation, params.userData);
  const openAlbumScreen = useOpenAlbumView(params.navigation, params.userData);

  const closeActiveOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const handleOpenProfile = useCallback(
    (username: string) => {
      openProfile(username);
    },
    [openProfile],
  );

  const handleOpenEventFromAlbum = useCallback(
    (eventId: string) => {
      openEventFromAlbum(eventId);
    },
    [openEventFromAlbum],
  );

  const handleOpenAlbumScreen = useCallback(
    (eventId: string) => {
      openAlbumScreen(eventId);
    },
    [openAlbumScreen],
  );

  const handleOpenNotifications = useCallback(() => {
    void requestNotificationPermissionFromUserInteraction();
    navigateToRegisteredRoute(params.navigation, "Notifications");
  }, [params.navigation]);

  const openEventOverlay = useCallback(
    (
      panel: "attendees" | "comments" | "likes" | "location",
      event: EventWithMeta,
      relations?: RelationSnapshot,
    ) => {
      setActiveOverlay({ kind: "event", panel, event, relations });
    },
    [],
  );

  return {
    activeOverlay,
    closeActiveOverlay,
    handleOpenAlbumScreen,
    handleOpenEventFromAlbum,
    handleOpenNotifications,
    handleOpenProfile,
    openEventOverlay,
  };
}
