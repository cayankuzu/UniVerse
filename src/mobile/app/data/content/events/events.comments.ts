import type { CommentItem, LikeResponse, SearchUserResult } from "../../contracts/api";
import {
  assertEventCommentCreateAllowed,
  assertEventCommentLikeAllowed,
} from "../../social/blockedInteractionGuard";
import { fetchEventCommentsFromApi } from "./events.models";
import type { CommentTableConfig } from "../shared/commentOperations";
import {
  addComment,
  getComments,
  getFilteredLikeUsers,
  loadCommentLikeState,
  toggleCommentLike,
} from "../shared/commentOperations";

const eventCommentConfig: CommentTableConfig = {
  commentsTable: "event_comments",
  foreignKeyColumn: "event_id",
  commentLikesTable: "event_comment_likes",
  createCommentRpc: "create_event_comment_with_patch",
  createCommentTargetParam: "target_event_id",
  setCommentLikeRpc: "set_event_comment_like",
  restEndpointPrefix: "/events",
  commentTelemetryTarget: "event-comment",
  commentLikeTelemetryTarget: "event-comment-like",
  commentMutationPrefix: "event-comment",
  commentLikeMutationPrefix: "event-comment-like",
  assertCommentCreateAllowed: (targetId, parentId, viewerIdHint) =>
    assertEventCommentCreateAllowed({ eventId: targetId, parentId, viewerIdHint }),
  assertCommentLikeAllowed: assertEventCommentLikeAllowed,
  fetchCommentsFromApiFallback: fetchEventCommentsFromApi,
};

export async function loadEventCommentLikeState(commentIds: string[], viewerId: string | null) {
  return loadCommentLikeState(eventCommentConfig, commentIds, viewerId);
}

export async function getEventComments(
  id: string,
  options?: { viewerId?: string | null },
): Promise<CommentItem[]> {
  return getComments(eventCommentConfig, id, options?.viewerId);
}

export async function addEventComment(
  id: string,
  text: string,
  parentId?: string | null,
  options?: { clientMutationId?: string | null },
): Promise<CommentItem> {
  return addComment(eventCommentConfig, id, text, parentId, options);
}

export async function toggleEventCommentLike(
  commentId: string,
  options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
): Promise<LikeResponse> {
  return toggleCommentLike(eventCommentConfig, commentId, options);
}

export async function getEventCommentLikes(commentId: string): Promise<SearchUserResult[]> {
  return getFilteredLikeUsers({
    column: "comment_id",
    relationTable: "event_comment_likes",
    targetId: commentId,
  });
}
