import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { buildOptimisticComment } from "../domain/commentPanel.helpers";
import type { CommentItem, SearchUserResult } from "../../../data/contracts/api";
import { debugWarn } from "../../../platform/logging/logger";
import type { ContentViewer } from "../data";
import {
  fetchAlbumCommentLikers,
  processCommentCreateActionQueue,
  queueAlbumCommentCreateAction,
  subscribeToCommentCreateAction,
  toggleAlbumCommentLike,
} from "../data";

interface UseAlbumFeedCardCommentActionsParams {
  commentCount: number;
  eventId: string;
  onShowWarning?: (message: string) => void;
  patchCommentCount: (count: number) => void;
  photoId: string;
  queryClient: QueryClient;
  setComments: Dispatch<SetStateAction<CommentItem[]>>;
  setCommentsLoaded: (value: boolean) => void;
  userData: ContentViewer;
  viewerId?: string;
}

export function useAlbumFeedCardCommentActions({
  commentCount,
  eventId,
  onShowWarning,
  patchCommentCount,
  photoId,
  queryClient,
  setComments,
  setCommentsLoaded,
  userData,
  viewerId,
}: UseAlbumFeedCardCommentActionsParams) {
  const isMountedRef = useRef(true);
  const commentCountRef = useRef(commentCount);
  const inFlightCommentLikeIdsRef = useRef(new Set<string>());

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    inFlightCommentLikeIdsRef.current.clear();
  }, [photoId]);

  useEffect(() => {
    commentCountRef.current = commentCount;
  }, [commentCount]);

  const handleAddComment = useCallback(
    async (text: string, parentId: string | null) => {
      const optimisticCount = Math.max(1, commentCountRef.current + 1);
      commentCountRef.current = optimisticCount;
      const optimisticComment = buildOptimisticComment({ parentId, text, user: userData });
      setComments((current) => [...current, optimisticComment]);
      setCommentsLoaded(true);
      patchCommentCount(optimisticCount);

      let entry;
      try {
        entry = await queueAlbumCommentCreateAction({
          eventId,
          optimisticCommentId: optimisticComment.id,
          ownerId: userData.id,
          parentId,
          photoId,
          text,
        });
      } catch (error) {
        debugWarn("CONTENT-CARDS", "album-comment-queue-failed", {
          eventId,
          message: String(
            (error as { message?: string } | null)?.message || "album-comment-queue-failed",
          ),
          photoId,
        });
        setComments((current) => current.filter((item) => item.id !== optimisticComment.id));
        commentCountRef.current = Math.max(0, optimisticCount - 1);
        patchCommentCount(commentCountRef.current);
        onShowWarning?.("Yorum sıra dışına alınamadı.");
        return;
      }

      let unsubscribe: () => void = () => {};
      unsubscribe = subscribeToCommentCreateAction(entry.id, {
        onFailed: () => {
          unsubscribe();
          if (!isMountedRef.current) return;
          setComments((current) => current.filter((item) => item.id !== optimisticComment.id));
          commentCountRef.current = Math.max(0, optimisticCount - 1);
          patchCommentCount(commentCountRef.current);
          onShowWarning?.("Yorum gönderilemedi.");
        },
        onResolved: (saved) => {
          unsubscribe();
          if (!isMountedRef.current) return;
          setComments((current) =>
            current.map((item) => (item.id === optimisticComment.id ? saved : item)),
          );
        },
      });

      void processCommentCreateActionQueue({
        entryId: entry.id,
        ownerId: userData.id,
        queryClient,
      });
    },
    [
      eventId,
      onShowWarning,
      patchCommentCount,
      photoId,
      queryClient,
      setComments,
      setCommentsLoaded,
      userData,
    ],
  );

  const handleToggleCommentLike = useCallback(
    async (comment: CommentItem) => {
      const commentId = String(comment.id || "").trim();
      if (!commentId || inFlightCommentLikeIdsRef.current.has(commentId)) return;
      const optimisticLiked = !comment.likedByViewer;
      const optimisticCount = Math.max(
        0,
        Number(comment.likesCount || 0) + (optimisticLiked ? 1 : -1),
      );
      inFlightCommentLikeIdsRef.current.add(commentId);

      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, likedByViewer: optimisticLiked, likesCount: optimisticCount }
            : item,
        ),
      );

      try {
        const response = await toggleAlbumCommentLike(comment.id, {
          desiredLiked: optimisticLiked,
        });
        setComments((current) =>
          current.map((item) =>
            item.id === comment.id
              ? { ...item, likedByViewer: response.liked, likesCount: response.count }
              : item,
          ),
        );
      } finally {
        inFlightCommentLikeIdsRef.current.delete(commentId);
      }
    },
    [setComments],
  );

  const safeHandleToggleCommentLike = useCallback(
    async (comment: CommentItem) => {
      try {
        await handleToggleCommentLike(comment);
      } catch (error) {
        debugWarn("CONTENT-CARDS", "album-comment-like-toggle-failed", {
          commentId: String(comment.id || ""),
          message: String(
            (error as { message?: string } | null)?.message || "album-comment-like-toggle-failed",
          ),
          photoId,
        });
        setComments((current) =>
          current.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  likedByViewer: Boolean(comment.likedByViewer),
                  likesCount: Number(comment.likesCount || 0),
                }
              : item,
          ),
        );
      }
    },
    [handleToggleCommentLike, photoId, setComments],
  );

  const loadCommentLikers = useCallback(
    async (comment: CommentItem): Promise<SearchUserResult[]> => {
      const rows = await fetchAlbumCommentLikers(comment.id, {}, viewerId);
      return Array.isArray(rows.items) ? rows.items : [];
    },
    [viewerId],
  );

  return {
    handleAddComment,
    handleToggleCommentLike: safeHandleToggleCommentLike,
    loadCommentLikers,
  };
}
