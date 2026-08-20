import type { ProjectionRequestContext } from "../projections/projections.request";
import { ProjectionAPI } from "../projections/projections.shared";
import { ReportAPI } from "../normalizers/reports";
import { supabase } from "../../platform/supabase";
import { AlbumAPI } from "./albums.api";
import { removeLocalAlbumShadow } from "./albums/albums.local";

interface AlbumLikeMutationOptions {
  clientMutationId?: string | null;
  desiredLiked?: boolean;
}

export async function deleteAlbumPhoto(photoId: string) {
  const result = await AlbumAPI.deletePhoto(photoId);
  await removeLocalAlbumShadow(photoId).catch(() => null);
  return result;
}

export function likeAlbumPhoto(photoId: string, options?: AlbumLikeMutationOptions) {
  return AlbumAPI.likePhoto(photoId, options);
}

export async function getAlbumPhotoLikes(photoId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const envelope = await ProjectionAPI.getAlbumPhotoLikers(photoId, {}, user?.id);
  return Array.isArray(envelope.items) ? envelope.items : [];
}

export function toggleAlbumCommentLike(
  commentId: string,
  options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
) {
  return AlbumAPI.togglePhotoCommentLike(commentId, options);
}

export function deleteAlbumComment(photoId: string, commentId: string) {
  return AlbumAPI.deletePhotoComment(photoId, commentId);
}

export function fetchAlbumComments(
  photoId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumComments(photoId, context, viewerId);
}

export function fetchAlbumCommentLikers(
  commentId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumCommentLikers(commentId, context, viewerId);
}

export function fetchAlbumPhotoLikers(
  photoId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getAlbumPhotoLikers(photoId, context, viewerId);
}

export function reportAlbum(params: { photoId: string; username: string }) {
  return ReportAPI.submit({
    reason: "Uygunsuz albüm",
    targetId: params.photoId,
    targetType: "album",
    targetUsername: params.username,
  });
}

export function reportAlbumComment(params: { commentId: string; username: string }) {
  return ReportAPI.submit({
    reason: "Uygunsuz yorum",
    targetId: params.commentId,
    targetType: "album_comment",
    targetUsername: params.username,
  });
}
