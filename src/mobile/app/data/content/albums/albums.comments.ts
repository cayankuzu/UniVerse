import type { CommentItem, LikeResponse, SearchUserResult } from "../../contracts/api";
import {
  assertAlbumCommentCreateAllowed,
  assertAlbumCommentLikeAllowed,
} from "../../social/blockedInteractionGuard";
import type { CommentTableConfig } from "../shared/commentOperations";
import {
  addComment,
  getComments,
  getFilteredLikeUsers,
  loadCommentLikeState,
  toggleCommentLike,
} from "../shared/commentOperations";

async function fetchAlbumPhotoCommentsFromApi(photoId: string): Promise<CommentItem[]> {
  void photoId;
  return [];
}

const albumCommentConfig: CommentTableConfig = {
  commentsTable: "album_photo_comments",
  foreignKeyColumn: "photo_id",
  commentLikesTable: "album_photo_comment_likes",
  createCommentRpc: "create_album_comment_with_patch",
  createCommentTargetParam: "target_photo_id",
  setCommentLikeRpc: "set_album_comment_like",
  restEndpointPrefix: "/albums",
  commentTelemetryTarget: "album-comment",
  commentLikeTelemetryTarget: "album-comment-like",
  commentMutationPrefix: "album-comment",
  commentLikeMutationPrefix: "album-comment-like",
  assertCommentCreateAllowed: (targetId, parentId, viewerIdHint) =>
    assertAlbumCommentCreateAllowed({ photoId: targetId, parentId, viewerIdHint }),
  assertCommentLikeAllowed: assertAlbumCommentLikeAllowed,
  fetchCommentsFromApiFallback: fetchAlbumPhotoCommentsFromApi,
};

export async function loadAlbumCommentLikeState(commentIds: string[], viewerId: string | null) {
  return loadCommentLikeState(albumCommentConfig, commentIds, viewerId);
}

export async function getAlbumPhotoComments(photoId: string): Promise<CommentItem[]> {
  return getComments(albumCommentConfig, photoId);
}

export async function addAlbumPhotoComment(
  photoId: string,
  text: string,
  parentId?: string | null,
  options?: { clientMutationId?: string | null },
): Promise<CommentItem> {
  return addComment(albumCommentConfig, photoId, text, parentId, options);
}

export async function toggleAlbumPhotoCommentLike(
  commentId: string,
  options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
): Promise<LikeResponse> {
  return toggleCommentLike(albumCommentConfig, commentId, options);
}

export async function getAlbumPhotoCommentLikes(commentId: string): Promise<SearchUserResult[]> {
  return getFilteredLikeUsers({
    column: "comment_id",
    relationTable: "album_photo_comment_likes",
    targetId: commentId,
  });
}

export async function getAlbumPhotoLikes(photoId: string): Promise<SearchUserResult[]> {
  return getFilteredLikeUsers({
    column: "photo_id",
    relationTable: "album_photo_likes",
    targetId: photoId,
  });
}
