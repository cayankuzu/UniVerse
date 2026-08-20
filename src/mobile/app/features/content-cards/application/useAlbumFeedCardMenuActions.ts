import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getAlbumButtonAction, type RelationSnapshot } from "../../../data/policies/visibility";
import { loadBlockedAlbumEventWarning } from "../../../data/social/blockedVisibility";
import { debugWarn } from "../../../platform/logging/logger";
import { useAppTransientActivity } from "../../../shared/feedback/AppTransientActivityContext";
import { showConfirmAlert } from "../../../shared/utils/alerts";
import type { AlbumPhotoWithMeta } from "../data";
import {
  deleteAlbumPhoto,
  refreshAlbumMutationScopes,
  removeAlbumMutationCaches,
  reportAlbum,
} from "../data";

type AlbumCardContext = "event_album" | "feed" | "profile" | "search";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

interface UseAlbumFeedCardMenuActionsParams {
  context: AlbumCardContext;
  currentUsername: string;
  onOpenClub: (clubUsername: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
  viewerUserId?: string;
}

export function useAlbumFeedCardMenuActions(params: UseAlbumFeedCardMenuActionsParams) {
  const {
    context,
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    viewerUserId,
  } = params;
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

        onShowWarning?.(buttonAction.message || "Etkinlik detayları şu anda açılamıyor.");
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
    showConfirmAlert({
      confirmLabel: "Sil",
      destructive: true,
      message: "Bu albüm kartını silmek istiyor musunuz?",
      onConfirm: async () => {
        setDeleteBusy(true);
        const activityId = showActivity({
          hint: "Albüm kartı listelerden ve veritabanından kaldırılıyor.",
          percent: 32,
          stage: "Albüm kartı siliniyor",
          title: "Albüm silme işlemi başladı",
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
            stage: "Albüm kartı kaldırıldı",
            title: "Albüm silindi",
            tone: "success",
          });
        } catch (error) {
          updateActivity(activityId, {
            dismissAfterMs: 2600,
            percent: 100,
            stage: String((error as { message?: string })?.message || "Albüm silinemedi."),
            title: "Albüm silinemedi",
            tone: "error",
          });
        } finally {
          setDeleteBusy(false);
        }
      },
      title: "Albümü Sil",
    });
  };

  const handleReportPhoto = () => {
    showConfirmAlert({
      confirmLabel: "Şikâyet Et",
      message: "Bu albüm kartını şikâyet etmek istiyor musunuz?",
      onConfirm: async () => {
        try {
          await reportAlbum({ photoId: photo.id, username: photo.username });
          onShowWarning?.("Şikâyetiniz alındı.");
        } catch (error) {
          debugWarn("CONTENT-CARDS", "album-report-failed", {
            message: String(
              (error as { message?: string } | null)?.message || "album-report-failed",
            ),
            photoId: photo.id,
          });
          onShowWarning?.("Şikâyet gönderilemedi.");
        }
      },
      title: "Albümü Şikâyet Et",
    });
  };

  const menuActions = canDeletePhoto
    ? [
        {
          destructive: true,
          key: "delete",
          label: deleteBusy ? "Siliniyor..." : "Albümü Sil",
          onPress: handleDeletePhoto,
        },
      ]
    : [
        {
          key: "report",
          label: "Albümü Şikâyet Et",
          onPress: handleReportPhoto,
        },
      ];

  return {
    buttonAction,
    handleActionPress,
    menuActions,
  };
}
