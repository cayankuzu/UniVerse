import { useCallback, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";

import type { CommentItem } from "../../../data/contracts/api";
import { debugWarn } from "../../../platform/logging/logger";
import type { ContentViewer } from "../data";
import { deleteAlbumComment, reportAlbumComment } from "../data";
import { collectCommentCascadeIds } from "../domain/commentTree.helpers";

interface UseAlbumFeedCardCommentModerationParams {
  comments: CommentItem[];
  deleteBusy: boolean;
  eventOwnerId?: string;
  invalidateAlbumCaches: () => void;
  onShowWarning?: (message: string) => void;
  patchCommentCount: (count: number) => void;
  photoId: string;
  setComments: Dispatch<SetStateAction<CommentItem[]>>;
  setDeleteBusy: (value: boolean) => void;
  userData: ContentViewer;
}

export function useAlbumFeedCardCommentModeration({
  comments,
  deleteBusy,
  eventOwnerId,
  invalidateAlbumCaches,
  onShowWarning,
  patchCommentCount,
  photoId,
  setComments,
  setDeleteBusy,
  userData,
}: UseAlbumFeedCardCommentModerationParams) {
  const canDeleteComment = useCallback(
    (comment: CommentItem) =>
      Boolean(userData.id) &&
      (String(comment.userId || "") === String(userData.id) ||
        String(eventOwnerId || "") === String(userData.id)),
    [eventOwnerId, userData.id],
  );

  const handleDeleteComment = useCallback(
    (comment: CommentItem) => {
      if (deleteBusy) return;
      const currentComments = comments;

      Alert.alert("Yorumu Sil", "Bu yorumu silmek istiyor musunuz?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const removedIds = collectCommentCascadeIds(currentComments, comment.id);
              const nextComments = currentComments.filter((item) => !removedIds.has(item.id));
              setDeleteBusy(true);
              setComments(nextComments);
              patchCommentCount(nextComments.length);
              try {
                await deleteAlbumComment(photoId, comment.id);
                invalidateAlbumCaches();
                onShowWarning?.("Yorum silindi.");
              } catch (error) {
                setComments(currentComments);
                patchCommentCount(currentComments.length);
                onShowWarning?.(
                  String((error as { message?: string })?.message || "Yorum silinemedi."),
                );
              } finally {
                setDeleteBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [
      comments,
      deleteBusy,
      invalidateAlbumCaches,
      onShowWarning,
      patchCommentCount,
      photoId,
      setComments,
      setDeleteBusy,
    ],
  );

  const handleReportComment = useCallback(
    (comment: CommentItem) => {
      Alert.alert("Yorumu Şikâyet Et", "Bu yorumu şikâyet etmek istiyor musunuz?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Şikayet Et",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await reportAlbumComment({
                  commentId: comment.id,
                  username: comment.username,
                });
                onShowWarning?.("Şikayetiniz alindi.");
              } catch (error) {
                debugWarn("CONTENT-CARDS", "album-comment-report-failed", {
                  commentId: String(comment.id || ""),
                  message: String(
                    (error as { message?: string } | null)?.message ||
                      "album-comment-report-failed",
                  ),
                  photoId,
                });
                onShowWarning?.("Şikayet gönderilemedi.");
              }
            })();
          },
        },
      ]);
    },
    [onShowWarning, photoId],
  );

  return {
    canDeleteComment,
    handleDeleteComment,
    handleReportComment,
  };
}
