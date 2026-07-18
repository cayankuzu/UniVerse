import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { buildOptimisticComment } from "../domain/commentPanel.helpers";
import { loadEventCommentLikers, toggleEventCommentLike } from "./eventCommentInteractions";
import type { CommentItem, SearchUserResult } from "../../../data/contracts/api";
import { debugWarn } from "../../../platform/logging/logger";
import type { ContentViewer } from "../data";
import {
  processCommentCreateActionQueue,
  queueEventCommentCreateAction,
  subscribeToCommentCreateAction,
} from "../data";

interface UseEventCardCommentActionsParams {
  commentCount: number;
  comments: CommentItem[];
  eventId: string;
  interactive: boolean;
  onShowWarning?: (message: string) => void;
  patchCommentCount: (count: number) => void;
  queryClient: QueryClient;
  setComments: Dispatch<SetStateAction<CommentItem[]>>;
  setCommentsLoaded: (value: boolean) => void;
  userData: ContentViewer;
  viewerId?: string;
}

export function useEventCardCommentActions({
  commentCount,
  comments,
  eventId,
  interactive,
  onShowWarning,
  patchCommentCount,
  queryClient,
  setComments,
  setCommentsLoaded,
  userData,
  viewerId,
}: UseEventCardCommentActionsParams) {
  const commentsRef = useRef<CommentItem[]>([]);
  const commentCountRef = useRef(commentCount);
  const inFlightCommentLikeIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    commentCountRef.current = commentCount;
  }, [commentCount]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    inFlightCommentLikeIdsRef.current.clear();
  }, [eventId]);

  const handleAddComment = useCallback(
    async (text: string, parentId: string | null) => {
      if (!interactive) return;

      const optimisticCount = Math.max(1, commentCountRef.current + 1);
      commentCountRef.current = optimisticCount;
      const optimisticComment = buildOptimisticComment({ parentId, text, user: userData });

      setComments((current) => [...current, optimisticComment]);
      setCommentsLoaded(true);
      patchCommentCount(optimisticCount);

      let entry;
      try {
        entry = await queueEventCommentCreateAction({
          eventId,
          optimisticCommentId: optimisticComment.id,
          ownerId: userData.id,
          parentId,
          text,
        });
      } catch (error) {
        debugWarn("CONTENT-CARDS", "event-comment-queue-failed", {
          eventId,
          message: String(
            (error as { message?: string } | null)?.message || "event-comment-queue-failed",
          ),
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
          const shouldReplayPendingLike = Boolean(
            commentsRef.current.find((item) => item.id === optimisticComment.id)?.likedByViewer,
          );
          if (!isMountedRef.current) return;
          setComments((current) =>
            current.map((item) => (item.id === optimisticComment.id ? saved : item)),
          );
          if (shouldReplayPendingLike) {
            void toggleEventCommentLike(saved, setComments, inFlightCommentLikeIdsRef.current);
          }
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
      interactive,
      onShowWarning,
      patchCommentCount,
      queryClient,
      setComments,
      setCommentsLoaded,
      userData,
    ],
  );

  const handleToggleCommentLike = useCallback(
    async (comment: CommentItem) => {
      await toggleEventCommentLike(comment, setComments, inFlightCommentLikeIdsRef.current);
    },
    [setComments],
  );

  const loadCommentLikers = useCallback(
    async (comment: CommentItem): Promise<SearchUserResult[]> => {
      return loadEventCommentLikers(comment, viewerId);
    },
    [viewerId],
  );

  return {
    handleAddComment,
    handleToggleCommentLike,
    loadCommentLikers,
  };
}
