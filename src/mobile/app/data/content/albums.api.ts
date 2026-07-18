import type { LikeResponse, SuccessResponse } from "../contracts/api";
import { del, post } from "../../platform/api/core";
import { supabase } from "../../platform/supabase";
import { observeMutation } from "../normalizers/mutationTelemetry";
import type { ClientMutationOptions } from "../mutations/clientMutation";
import { assertAlbumInteractionAllowed } from "../social/blockedInteractionGuard";
import {
  addAlbumPhotoComment,
  getAlbumPhotoCommentLikes,
  getAlbumPhotoComments,
  getAlbumPhotoLikes,
  toggleAlbumPhotoCommentLike,
} from "./albums/albums.comments";
import { albumReads } from "./albums/albums.reads";
import { triggerPushDispatchWakeup } from "../notifications/pushDispatchWakeup";

type AlbumLikeMutationOptions = ClientMutationOptions & {
  desiredLiked?: boolean;
};

async function readAlbumPhotoLikeState(photoId: string, userId: string) {
  const [{ count }, { data: viewerLike, error: viewerLikeError }] = await Promise.all([
    supabase
      .from("album_photo_likes")
      .select("photo_id", { count: "exact", head: true })
      .eq("photo_id", photoId),
    supabase
      .from("album_photo_likes")
      .select("photo_id")
      .eq("photo_id", photoId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (viewerLikeError) return null;
  return {
    count: count || 0,
    liked: Boolean(viewerLike),
  } satisfies LikeResponse;
}

async function reconcileAlbumPhotoLikeDirect(
  photoId: string,
  userId: string,
  desiredLiked: boolean,
) {
  if (desiredLiked) {
    const { error } = await supabase
      .from("album_photo_likes")
      .insert({ photo_id: photoId, user_id: userId });
    if (
      error &&
      !String(error.message || "")
        .toLowerCase()
        .includes("duplicate")
    ) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("album_photo_likes")
      .delete()
      .eq("photo_id", photoId)
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
  }

  const verified = await readAlbumPhotoLikeState(photoId, userId);
  return (
    verified || {
      count: 0,
      liked: desiredLiked,
    }
  );
}

export const AlbumAPI = {
  getFeed: albumReads.getFeed,
  getSearchFeed: albumReads.getSearchFeed,
  getHomeFeed: albumReads.getHomeFeed,
  getEventPhotos: albumReads.getEventPhotos,
  getVisibleByEventIds: albumReads.getVisibleByEventIds,
  getPhotos: albumReads.getPhotos,
  getPhotoComments: getAlbumPhotoComments,
  addPhotoComment: addAlbumPhotoComment,
  getPhotoCommentLikes: getAlbumPhotoCommentLikes,
  getPhotoLikes: getAlbumPhotoLikes,
  togglePhotoCommentLike: (
    commentId: string,
    options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
  ) => toggleAlbumPhotoCommentLike(commentId, options),
  likePhoto: async (photoId: string, options?: AlbumLikeMutationOptions): Promise<LikeResponse> =>
    observeMutation({
      meta: { photoId, target: "album-like" },
      name: "album-like-toggle",
      task: async () => {
        let source = "rpc";
        const desiredLiked =
          typeof options?.desiredLiked === "boolean" ? options.desiredLiked : null;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await assertAlbumInteractionAllowed({
          photoId,
          viewerIdHint: user?.id,
        });
        const { data, error } = await supabase.rpc("toggle_album_photo_like", {
          target_photo_id: photoId,
        });

        if (!error) {
          let result = {
            count: Number((Array.isArray(data) ? data[0] : data)?.likes_count || 0),
            liked: Boolean((Array.isArray(data) ? data[0] : data)?.liked),
          };
          if (user?.id && desiredLiked !== null) {
            const verified = await readAlbumPhotoLikeState(photoId, user.id);
            if (verified?.liked === desiredLiked) {
              result = verified;
            } else {
              result = await reconcileAlbumPhotoLikeDirect(photoId, user.id, desiredLiked);
              source = "table-reconcile";
            }
          }
          triggerPushDispatchWakeup("album-like-toggle");
          return {
            ...result,
            source,
          };
        }

        if (user?.id && desiredLiked !== null) {
          const verified = await readAlbumPhotoLikeState(photoId, user.id);
          if (verified?.liked === desiredLiked) {
            triggerPushDispatchWakeup("album-like-toggle");
            return { ...verified, source: "table-verified" };
          }
          const reconciled = await reconcileAlbumPhotoLikeDirect(photoId, user.id, desiredLiked);
          triggerPushDispatchWakeup("album-like-toggle");
          return { ...reconciled, source: "table-reconcile" };
        }

        const result = await post<LikeResponse>(`/albums/${photoId}/like`);
        triggerPushDispatchWakeup("album-like-toggle");
        return { ...result, source: "edge" };
      },
      toSuccessMeta: (result) => ({
        liked: result.liked,
        source: (result as LikeResponse & { source?: string }).source || "rpc",
      }),
    }),
  deletePhoto: async (photoId: string): Promise<SuccessResponse> =>
    del<SuccessResponse>(`/albums/${photoId}`),
  deletePhotoComment: async (photoId: string, commentId: string): Promise<SuccessResponse> =>
    del<SuccessResponse>(`/albums/${photoId}/comments/${commentId}`),
};
