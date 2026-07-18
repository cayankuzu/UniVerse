import { useCallback, useState } from "react";
import type { CommentItem, SearchUserResult } from "../../data";

interface UseCommentLikesSheetParams {
  onOpenCommentLikes?: (comment: CommentItem) => Promise<SearchUserResult[]> | SearchUserResult[];
}

export function useCommentLikesSheet({ onOpenCommentLikes }: UseCommentLikesSheetParams) {
  const [commentLikesVisible, setCommentLikesVisible] = useState(false);
  const [commentLikesLoading, setCommentLikesLoading] = useState(false);
  const [commentLikesRefreshing, setCommentLikesRefreshing] = useState(false);
  const [commentLikesUsers, setCommentLikesUsers] = useState<SearchUserResult[]>([]);
  const [commentLikesComment, setCommentLikesComment] = useState<CommentItem | null>(null);

  const resetCommentLikesSheet = useCallback(() => {
    setCommentLikesVisible(false);
    setCommentLikesLoading(false);
    setCommentLikesRefreshing(false);
    setCommentLikesUsers([]);
    setCommentLikesComment(null);
  }, []);

  const openCommentLikes = useCallback(
    async (comment: CommentItem) => {
      if (!onOpenCommentLikes) return;
      setCommentLikesComment(comment);
      setCommentLikesVisible(true);
      setCommentLikesLoading(true);
      try {
        const users = await onOpenCommentLikes(comment);
        setCommentLikesUsers(users);
      } finally {
        setCommentLikesLoading(false);
      }
    },
    [onOpenCommentLikes],
  );

  const refreshCommentLikes = useCallback(async () => {
    if (!commentLikesComment || !onOpenCommentLikes) return;
    setCommentLikesRefreshing(true);
    try {
      const users = await onOpenCommentLikes(commentLikesComment);
      setCommentLikesUsers(users);
    } finally {
      setCommentLikesRefreshing(false);
    }
  }, [commentLikesComment, onOpenCommentLikes]);

  return {
    commentLikesComment,
    commentLikesLoading,
    commentLikesRefreshing,
    commentLikesUsers,
    commentLikesVisible,
    openCommentLikes,
    refreshCommentLikes,
    resetCommentLikesSheet,
    setCommentLikesVisible,
  };
}
