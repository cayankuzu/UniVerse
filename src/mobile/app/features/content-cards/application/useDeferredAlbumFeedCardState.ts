import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAlbumButtonAction, type RelationSnapshot } from "../../../data/policies/visibility";
import { loadBlockedAlbumEventWarning } from "../../../data/social/blockedVisibility";
import { debugWarn } from "../../../platform/logging/logger";
import type { AlbumPhotoWithMeta } from "../data";
import {
  patchAlbumMutationCaches,
  processContentToggleQueue,
  queueOrReplaceAlbumLikeToggleAction,
  subscribeToAlbumLikeToggleAction,
} from "../data";

export function useDeferredAlbumFeedCardState(params: {
  context?: "feed" | "search" | "profile" | "event_album";
  currentUsername: string;
  onOpenClub: (clubUsername: string) => void;
  onOpenEvent: (eventId: string) => void;
  onShowWarning?: (message: string) => void;
  ownerId?: string;
  photo: AlbumPhotoWithMeta;
  relations?: RelationSnapshot;
}) {
  const {
    context = "feed",
    currentUsername,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    ownerId,
    photo,
    relations,
  } = params;
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  const [liked, setLiked] = useState(Boolean(photo.liked));
  const [likes, setLikes] = useState(Number(photo.likes || 0));

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    setLiked(Boolean(photo.liked));
    setLikes(Number(photo.likes || 0));
  }, [photo.id, photo.liked, photo.likes]);

  const buttonAction = useMemo(
    () => getAlbumButtonAction(currentUsername, photo, relations, context),
    [context, currentUsername, photo, relations],
  );
  const patchAlbumCaches = useCallback(
    (patch: Partial<AlbumPhotoWithMeta>) => {
      patchAlbumMutationCaches<AlbumPhotoWithMeta>({
        eventId: photo.eventId,
        patch,
        photoId: photo.id,
        queryClient,
      });
    },
    [photo.eventId, photo.id, queryClient],
  );
  const handleLike = useCallback(async () => {
    const nextLiked = !liked;
    const optimisticLikes = Math.max(0, likes + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setLikes(optimisticLikes);
    patchAlbumCaches({ liked: nextLiked, likes: optimisticLikes });

    try {
      const { entry } = await queueOrReplaceAlbumLikeToggleAction({
        eventId: photo.eventId,
        ownerId,
        photoId: photo.id,
        previousCount: likes,
        previousLiked: liked,
        targetLiked: nextLiked,
      });
      subscribeToAlbumLikeToggleAction(entry.id, {
        onFailed: ({ previousCount, previousLiked }) => {
          if (!isMountedRef.current) return;
          setLiked(previousLiked);
          setLikes(previousCount);
          patchAlbumCaches({ liked: previousLiked, likes: previousCount });
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          setLiked(response.liked);
          setLikes(response.count);
          patchAlbumCaches({ liked: response.liked, likes: response.count });
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId,
        queryClient,
      });
    } catch (error) {
      debugWarn("CONTENT-CARDS", "deferred-album-like-toggle-queue-failed", {
        message: String(
          (error as { message?: string } | null)?.message ||
            "deferred-album-like-toggle-queue-failed",
        ),
        photoId: photo.id,
      });
      setLiked(liked);
      setLikes(likes);
      patchAlbumCaches({ liked, likes });
    }
  }, [liked, likes, ownerId, patchAlbumCaches, photo.eventId, photo.id, queryClient]);
  const handleActionPress = useCallback(() => {
    if (buttonAction.action === "view_event") {
      void (async () => {
        const blockedMessage = await loadBlockedAlbumEventWarning(photo, ownerId);
        if (blockedMessage) {
          onShowWarning?.(blockedMessage);
          return;
        }

        if (photo.eventId) {
          onOpenEvent(photo.eventId);
          return;
        }

        onShowWarning?.(buttonAction.message || "Etkinlik detayları şu anda açılamıyor.");
      })();
      return;
    }
    if (buttonAction.action === "view_club") {
      if (photo.clubUsername) {
        onOpenClub(photo.clubUsername);
        return;
      }
      onShowWarning?.(buttonAction.message || "Kulüp profili şu anda açılamıyor.");
      return;
    }
    onShowWarning?.(buttonAction.message || "Bu albüm için ek işlem bulunmuyor.");
  }, [
    buttonAction.action,
    buttonAction.message,
    onOpenClub,
    onOpenEvent,
    onShowWarning,
    ownerId,
    photo,
  ]);

  return {
    buttonAction,
    commentCount: Number(photo.comments || 0),
    handleActionPress,
    handleLike,
    liked,
    likes,
  };
}
