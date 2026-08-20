import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { EventWithMeta } from "../data";
import type { CommentItem } from "../../../data/contracts/api";
import { debugWarn } from "../../../platform/logging/logger";
import { useAppTransientActivity } from "../../../shared/feedback/AppTransientActivityContext";
import {
  deleteEvent,
  deleteEventComment,
  reportEvent,
  reportEventComment,
  removeEventMutationCaches,
} from "../data";
import { collectCommentCascadeIds } from "../domain/commentTree.helpers";
import { showConfirmAlert } from "../../../shared/utils/alerts";

type EventInteractionPatch = {
  attendees?: number;
  comments?: number;
  joined?: boolean;
  liked?: boolean;
  likes?: number;
};

interface UseEventModerationActionsParams {
  canDeleteEvent: boolean;
  comments: CommentItem[];
  event: EventWithMeta;
  interactive: boolean;
  invalidateEventCaches: () => void;
  onShowWarning?: (message: string) => void;
  patchEventCaches: (patch: EventInteractionPatch) => void;
  queryClient: QueryClient;
  setComments: Dispatch<SetStateAction<CommentItem[]>>;
  userId?: string;
}

export function useEventModerationActions(params: UseEventModerationActionsParams) {
  const {
    canDeleteEvent,
    comments,
    event,
    interactive,
    invalidateEventCaches,
    onShowWarning,
    patchEventCaches,
    queryClient,
    setComments,
    userId,
  } = params;
  const { showActivity, updateActivity } = useAppTransientActivity();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const handleReport = async (reason: string) => {
    if (!interactive) return;

    try {
      await reportEvent({ eventId: event.id, reason });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 1500);
    } catch (error) {
      debugWarn("CONTENT-CARDS", "event-report-failed", {
        eventId: event.id,
        message: String((error as { message?: string } | null)?.message || "event-report-failed"),
      });
      setShowReportModal(false);
      setReportSubmitted(false);
    }
  };

  const openDeleteConfirmModal = useCallback(() => {
    if (!interactive || !canDeleteEvent || deleteBusy) return;
    setShowDeleteConfirmModal(true);
  }, [canDeleteEvent, deleteBusy, interactive]);

  const closeDeleteConfirmModal = useCallback(() => {
    if (deleteBusy) return;
    setShowDeleteConfirmModal(false);
  }, [deleteBusy]);

  const handleDeleteEvent = useCallback(async () => {
    if (!interactive || !canDeleteEvent || deleteBusy) return;
    setDeleteBusy(true);
    const activityId = showActivity({
      hint: "Etkinlik kartı listelerden ve veritabanından kaldırılıyor.",
      percent: 32,
      stage: "Etkinlik siliniyor",
      title: "Etkinlik silme işlemi başladı",
      tone: "info",
    });
    try {
      await deleteEvent(event.id);
      removeEventMutationCaches<typeof event>({
        eventId: event.id,
        queryClient,
      });
      setShowDeleteConfirmModal(false);
      updateActivity(activityId, {
        dismissAfterMs: 1800,
        percent: 100,
        stage: "Etkinlik kaldırıldı",
        title: "Etkinlik silindi",
        tone: "success",
      });
    } catch (error) {
      updateActivity(activityId, {
        dismissAfterMs: 2600,
        percent: 100,
        stage: String((error as { message?: string })?.message || "Etkinlik silinemedi."),
        title: "Etkinlik silinemedi",
        tone: "error",
      });
    } finally {
      setDeleteBusy(false);
    }
  }, [canDeleteEvent, deleteBusy, event, interactive, queryClient, showActivity, updateActivity]);

  const handleDeleteComment = useCallback(
    (comment: CommentItem) => {
      if (!interactive || deleteBusy) return;
      showConfirmAlert({
        confirmLabel: "Sil",
        destructive: true,
        message: "Bu yorumu silmek istiyor musunuz?",
        onConfirm: async () => {
          const removedIds = collectCommentCascadeIds(comments, comment.id);
          const nextComments = comments.filter((item) => !removedIds.has(item.id));
          const nextCount = Math.max(0, nextComments.length);
          setDeleteBusy(true);
          setComments(nextComments);
          patchEventCaches({ comments: nextCount });
          try {
            await deleteEventComment(event.id, comment.id);
            invalidateEventCaches();
            onShowWarning?.("Yorum silindi.");
          } catch (error) {
            setComments(comments);
            patchEventCaches({ comments: comments.length });
            onShowWarning?.(
              String((error as { message?: string })?.message || "Yorum silinemedi."),
            );
          } finally {
            setDeleteBusy(false);
          }
        },
        title: "Yorumu Sil",
      });
    },
    [
      comments,
      deleteBusy,
      event.id,
      interactive,
      invalidateEventCaches,
      onShowWarning,
      patchEventCaches,
      setComments,
    ],
  );

  const handleReportComment = useCallback(
    (comment: CommentItem) => {
      if (!interactive || deleteBusy) return;
      showConfirmAlert({
        confirmLabel: "Şikâyet Et",
        message: "Bu yorumu şikâyet etmek istiyor musunuz?",
        onConfirm: async () => {
          try {
            await reportEventComment({
              commentId: comment.id,
              username: comment.username,
            });
            onShowWarning?.("Şikâyetiniz alındı.");
          } catch (error) {
            debugWarn("CONTENT-CARDS", "event-comment-report-failed", {
              commentId: String(comment.id || ""),
              eventId: event.id,
              message: String(
                (error as { message?: string } | null)?.message || "event-comment-report-failed",
              ),
            });
            onShowWarning?.("Şikâyet gönderilemedi.");
          }
        },
        title: "Yorumu Şikâyet Et",
      });
    },
    [deleteBusy, event.id, interactive, onShowWarning],
  );

  const eventMenuActions = useMemo(
    () =>
      canDeleteEvent
        ? [
            {
              key: "delete",
              label: deleteBusy ? "Siliniyor..." : "Etkinliği Sil",
              destructive: true,
              onPress: openDeleteConfirmModal,
            },
          ]
        : [
            {
              key: "report",
              label: "Etkinliği Şikâyet Et",
              onPress: () => setShowReportModal(true),
            },
          ],
    [canDeleteEvent, deleteBusy, openDeleteConfirmModal],
  );

  const canDeleteComment = useCallback(
    (comment: CommentItem) =>
      Boolean(userId) &&
      (String(comment.userId || "") === String(userId) ||
        String(event.clubUserId || "") === String(userId)),
    [event.clubUserId, userId],
  );

  return {
    canDeleteComment,
    deleteBusy,
    closeDeleteConfirmModal,
    eventMenuActions,
    handleDeleteComment,
    handleDeleteEvent,
    handleReport,
    handleReportComment,
    openDeleteConfirmModal,
    reportSubmitted,
    setShowDeleteConfirmModal,
    setShowReportModal,
    showDeleteConfirmModal,
    showReportModal,
  };
}
