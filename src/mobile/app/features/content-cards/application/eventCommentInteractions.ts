import type { Dispatch, SetStateAction } from "react";
import type { CommentItem, SearchUserResult } from "../data";
import { debugWarn } from "../../../platform/logging/logger";
import {
  fetchEventCommentLikers,
  toggleEventCommentLike as persistEventCommentLike,
} from "../data";

type SetComments = Dispatch<SetStateAction<CommentItem[]>>;
type CommentLikeState = Pick<CommentItem, "likedByViewer" | "likesCount">;

function resolveCommentLikeState(comment: CommentItem): CommentLikeState {
  return {
    likedByViewer: Boolean(comment.likedByViewer),
    likesCount: Number(comment.likesCount || 0),
  };
}

function getNextCommentLikeState(comment: CommentItem): CommentLikeState {
  const optimisticLiked = !comment.likedByViewer;
  const optimisticCount = Math.max(0, Number(comment.likesCount || 0) + (optimisticLiked ? 1 : -1));
  return {
    likedByViewer: optimisticLiked,
    likesCount: optimisticCount,
  };
}

export function isOptimisticCommentId(commentId: string) {
  return String(commentId || "")
    .trim()
    .startsWith("local-");
}

export function setEventCommentLikeState(
  setComments: SetComments,
  commentId: string,
  state: CommentLikeState,
) {
  setComments((current) =>
    current.map((item) =>
      item.id === commentId
        ? { ...item, likedByViewer: state.likedByViewer, likesCount: state.likesCount }
        : item,
    ),
  );
}

export async function toggleEventCommentLike(
  comment: CommentItem,
  setComments: SetComments,
  inFlightCommentIds?: Set<string>,
) {
  const commentId = String(comment.id || "").trim();
  if (!commentId || inFlightCommentIds?.has(commentId)) return;

  const previousState = resolveCommentLikeState(comment);
  const nextState = getNextCommentLikeState(comment);

  setEventCommentLikeState(setComments, commentId, nextState);

  if (isOptimisticCommentId(commentId)) return;

  inFlightCommentIds?.add(commentId);

  try {
    const response = await persistEventCommentLike(commentId, {
      desiredLiked: nextState.likedByViewer,
    });
    setEventCommentLikeState(setComments, commentId, {
      likedByViewer: response.liked,
      likesCount: response.count,
    });
  } catch (error) {
    debugWarn("CONTENT-CARDS", "event-comment-like-toggle-failed", {
      commentId,
      message: String(
        (error as { message?: string } | null)?.message || "event-comment-like-toggle-failed",
      ),
    });
    setEventCommentLikeState(setComments, commentId, previousState);
  } finally {
    inFlightCommentIds?.delete(commentId);
  }
}

export async function loadEventCommentLikers(
  comment: CommentItem,
  viewerId?: string,
): Promise<SearchUserResult[]> {
  const rows = await fetchEventCommentLikers(comment.id, {}, viewerId);
  return Array.isArray(rows.items) ? rows.items : [];
}
