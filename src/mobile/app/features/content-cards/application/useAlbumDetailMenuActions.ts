import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { getAlbumButtonAction, type RelationSnapshot } from "../../../data/policies/visibility";
import { loadBlockedAlbumEventWarning } from "../../../data/social/blockedVisibility";
import { debugWarn } from "../../../platform/logging/logger";
import { useAppTransientActivity } from "../../../shared/feedback/AppTransientActivityContext";
import type { AlbumPhotoWithMeta } from "../data";
import {
  deleteAlbumPhoto,
  refreshAlbumMutationScopes,
  removeAlbumMutationCaches,
  reportAlbum,
} from "../data";

type AlbumDetailContext = "event_album" | "feed" | "profile" | "search";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

interface UseAlbumDetailMenuActionsParams {
  context: AlbumDetailContext;
  currentUsername: string;
  onOpenClub: (clubUsername: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
  viewerUserId?: string;
}

export function useAlbumDetailMenuActions({
  context,
  currentUsername,
  onOpenClub,
  onOpenEvent,
  onShowWarning,
  photo,
  relations,
  viewerUserId,
}: UseAlbumDetailMenuActionsParams) {
  const queryClient = useQueryClient();
  const { showActivity, updateActivity } = useAppTransientActivity();
  const [deleteBusy, setDeleteBusy] = useState(false);

  const buttonAction = useMemo(
    () => getAlbumButtonAction(currentUsername, photo, relations, context),
    [context, currentUsername, photo, relations],
  );

  const canDeletePhoto = useMemo(
    () =>
      Boolean(viewerUserId || currentUsername) &&
      (String(photo.userId || "") === String(viewerUserId || "") ||
        normalize(currentUsername) === normalize(photo.username || "") ||
        String(photo.clubUserId || "") === String(viewerUserId || "") ||
        normalize(currentUsername) === normalize(photo.clubUsername || "")),
    [
      currentUsername,
      photo.clubUserId,
      photo.clubUsername,
      photo.userId,
      photo.username,
      viewerUserId,
    ],
  );

  const invalidateAlbumCaches = () => {
    refreshAlbumMutationScopes(queryClient, photo.eventId);
  };

  const handleActionPress = () => {
    if (buttonAction.action === "view_event") {
      void (async () => {
        const blockedMessage = await loadBlockedAlbumEventWarning(photo, viewerUserId);
        if (blockedMessage) {
          onShowWarning?.(blockedMessage);
          return;
        }

        if (photo.eventId) {
          onOpenEvent(photo.eventId);
          return;
        }

        onShowWarning?.(buttonAction.message || "Etkinlik detaylari su anda acilamiyor.");
      })();
      return;
    }

    if (buttonAction.action === "view_club") {
      if (buttonAction.message) {
        onShowWarning?.(buttonAction.message);
      }
      if (photo.clubUsername) onOpenClub(photo.clubUsername);
      return;
    }

    if (buttonAction.message) {
      onShowWarning?.(buttonAction.message);
    }
  };

  const handleDeletePhoto = () => {
    if (!canDeletePhoto || deleteBusy) return;
    Alert.alert("Albumu Sil", "Bu album kartini silmek istiyor musunuz?", [
      { style: "cancel", text: "Vazgec" },
      {
        onPress: () => {
          void (async () => {
            setDeleteBusy(true);
            const activityId = showActivity({
              hint: "Album karti listelerden ve veritabanindan kaldiriliyor.",
              percent: 32,
              stage: "Album karti siliniyor",
              title: "Album silme islemi basladi",
              tone: "info",
            });
            try {
              await deleteAlbumPhoto(photo.id);
              removeAlbumMutationCaches<AlbumPhotoWithMeta>({
                eventId: photo.eventId,
                photoId: photo.id,
                queryClient,
              });
              invalidateAlbumCaches();
              updateActivity(activityId, {
                dismissAfterMs: 1800,
                percent: 100,
                stage: "Album karti kaldirildi",
                title: "Album silindi",
                tone: "success",
              });
            } catch (error) {
              updateActivity(activityId, {
                dismissAfterMs: 2600,
                percent: 100,
                stage: String((error as { message?: string })?.message || "Album silinemedi."),
                title: "Album silinemedi",
                tone: "error",
              });
            } finally {
              setDeleteBusy(false);
            }
          })();
        },
        style: "destructive",
        text: "Sil",
      },
    ]);
  };

  const handleReportPhoto = () => {
    Alert.alert("Albumu Sikayet Et", "Bu album kartini sikayet etmek istiyor musunuz?", [
      { style: "cancel", text: "Vazgec" },
      {
        onPress: () => {
          void (async () => {
            try {
              await reportAlbum({ photoId: photo.id, username: photo.username });
              onShowWarning?.("Sikayetiniz alindi.");
            } catch (error) {
              debugWarn("CONTENT-CARDS", "album-detail-report-failed", {
                message: String(
                  (error as { message?: string } | null)?.message || "album-detail-report-failed",
                ),
                photoId: photo.id,
              });
              onShowWarning?.("Sikayet gonderilemedi.");
            }
          })();
        },
        style: "destructive",
        text: "Sikayet Et",
      },
    ]);
  };

  const menuActions = canDeletePhoto
    ? [
        {
          destructive: true,
          key: "delete",
          label: deleteBusy ? "Siliniyor..." : "Albumu Sil",
          onPress: handleDeletePhoto,
        },
      ]
    : [
        {
          key: "report",
          label: "Albumu Sikayet Et",
          onPress: handleReportPhoto,
        },
      ];

  return {
    buttonAction,
    handleActionPress,
    menuActions,
  };
}
