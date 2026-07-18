import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections";
import type { AlbumPhotoWithMeta } from "../data";
import type { CommentItem, SearchUserResult } from "../../../data/contracts/api";
import {
  fetchAlbumComments,
  fetchAlbumPhotoLikers,
  patchAlbumMutationCaches,
  processContentToggleQueue,
  queueOrReplaceAlbumLikeToggleAction,
  refreshAlbumMutationScopes,
  subscribeToAlbumLikeToggleAction,
} from "../data";
import type { ContentViewer } from "../data";
import { useAlbumFeedCardCommentActions } from "./useAlbumFeedCardCommentActions";
import { useAlbumFeedCardCommentModeration } from "./useAlbumFeedCardCommentModeration";
import { debugWarn } from "../../../platform/logging/logger";
import { startObservedTimer } from "../../../platform/observability";
import { readProjectionListCache, writeProjectionListCache } from "./projectionListCache";

interface UseAlbumPhotoInteractionStateParams {
  onShowWarning?: (message: string) => void;
  photo: AlbumPhotoWithMeta;
  showLikesModal: boolean;
  /** Telemetry prefix, e.g. "album_card_modal" or "album_detail_modal" */
  telemetryPrefix: string;
  userData: ContentViewer;
}

export function useAlbumPhotoInteractionState(params: UseAlbumPhotoInteractionStateParams) {
  const { onShowWarning, photo, showLikesModal, telemetryPrefix, userData } = params;
  const viewerId = userData.id;
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(Boolean(photo.liked));
  const [likes, setLikes] = useState(Number(photo.likes || 0));
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsRefreshing, setCommentsRefreshing] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesRefreshing, setLikesRefreshing] = useState(false);
  const [likers, setLikers] = useState<SearchUserResult[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const inFlightCommentsLoadRef = useRef<Promise<CommentItem[]> | null>(null);
  const inFlightLikersLoadRef = useRef<Promise<SearchUserResult[]> | null>(null);
  const isMountedRef = useRef(true);
  const likedRef = useRef(Boolean(photo.liked));
  const likesRef = useRef(Number(photo.likes || 0));

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const nextLiked = Boolean(photo.liked);
    const nextLikes = Number(photo.likes || 0);
    likedRef.current = nextLiked;
    likesRef.current = nextLikes;
    setLiked(nextLiked);
    setLikes(nextLikes);
  }, [photo.id, photo.liked, photo.likes]);

  useEffect(() => {
    setLikesLoading(false);
    setLikesRefreshing(false);
    setLikers([]);
    inFlightCommentsLoadRef.current = null;
    inFlightLikersLoadRef.current = null;
  }, [photo.id]);

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

  const invalidateAlbumCaches = useCallback(() => {
    refreshAlbumMutationScopes(queryClient, photo.eventId);
  }, [photo.eventId, queryClient]);

  const refreshComments = useCallback(async (): Promise<void> => {
    if (inFlightCommentsLoadRef.current) {
      await inFlightCommentsLoadRef.current;
      return;
    }
    const cachedSnapshot = readProjectionListCache<CommentItem>({
      entity: "album-comments",
      queryClient,
      screenKey: projectionKeys.albumComments(photo.id),
    });
    if (cachedSnapshot.hasSnapshot) {
      setComments(cachedSnapshot.items);
      setCommentsLoaded(true);
    }
    const shouldShowBusy = !cachedSnapshot.hasSnapshot;
    if (shouldShowBusy) {
      setCommentsRefreshing(true);
    }
    const refreshPromise = (async () => {
      const stopTelemetry = startObservedTimer({
        category: "projection",
        meta: {
          cacheHit: cachedSnapshot.hasSnapshot,
          targetId: photo.id,
        },
        name: `${telemetryPrefix}:comments`,
        screenKey: photo.id,
      });
      try {
        const rows = await fetchAlbumComments(photo.id, {}, viewerId);
        const nextRows = Array.isArray(rows.items) ? rows.items : [];
        setComments(nextRows);
        setCommentsLoaded(true);
        writeProjectionListCache({
          entity: "album-comments",
          items: nextRows,
          queryClient,
          screenKey: projectionKeys.albumComments(photo.id),
        });
        stopTelemetry("ok", {
          rowCount: nextRows.length,
        });
        return nextRows;
      } catch (error) {
        debugWarn("CONTENT-CARDS", `${telemetryPrefix}-comments-load-failed`, {
          message: String(
            (error as { message?: string } | null)?.message ||
              `${telemetryPrefix}-comments-load-failed`,
          ),
          photoId: photo.id,
        });
        if (!commentsLoaded) {
          setCommentsLoaded(true);
        }
        stopTelemetry("rollback", {
          rowCount: 0,
        });
        return cachedSnapshot.items;
      } finally {
        if (shouldShowBusy) {
          setCommentsRefreshing(false);
        }
      }
    })().finally(() => {
      if (inFlightCommentsLoadRef.current === refreshPromise) {
        inFlightCommentsLoadRef.current = null;
      }
    });
    inFlightCommentsLoadRef.current = refreshPromise;
    await refreshPromise;
  }, [commentsLoaded, photo.id, queryClient, telemetryPrefix, viewerId]);

  const loadLikers = useCallback(
    async (options?: { pullToRefresh?: boolean }): Promise<void> => {
      const pullToRefresh = options?.pullToRefresh ?? false;
      if (inFlightLikersLoadRef.current) {
        if (!pullToRefresh) {
          setLikers(await inFlightLikersLoadRef.current);
          return;
        }
        setLikesRefreshing(true);
        try {
          setLikers(await inFlightLikersLoadRef.current);
        } finally {
          setLikesRefreshing(false);
        }
        return;
      }
      const cacheKey = projectionKeys.screen("album-photo-likers", photo.id);
      const cachedSnapshot = readProjectionListCache<SearchUserResult>({
        entity: "album-photo-likers",
        queryClient,
        screenKey: cacheKey,
      });
      if (!pullToRefresh && cachedSnapshot.hasSnapshot) {
        setLikers(cachedSnapshot.items);
      }
      const shouldShowBusy = pullToRefresh || !cachedSnapshot.hasSnapshot;
      if (shouldShowBusy) {
        if (pullToRefresh) setLikesRefreshing(true);
        else setLikesLoading(true);
      }

      const loadPromise = (async () => {
        const stopTelemetry = startObservedTimer({
          category: "projection",
          meta: {
            cacheHit: !pullToRefresh && cachedSnapshot.hasSnapshot,
            mode: pullToRefresh ? "pull-to-refresh" : "open",
            targetId: photo.id,
          },
          name: `${telemetryPrefix}:likers`,
          screenKey: photo.id,
        });
        try {
          const rows = await fetchAlbumPhotoLikers(photo.id, {}, viewerId);
          const nextRows = Array.isArray(rows.items) ? rows.items : [];
          setLikers(nextRows);
          writeProjectionListCache({
            entity: "album-photo-likers",
            items: nextRows,
            queryClient,
            screenKey: cacheKey,
          });
          stopTelemetry("ok", {
            rowCount: nextRows.length,
          });
          return nextRows;
        } catch (error) {
          stopTelemetry("error", {
            message: String((error as { message?: string } | null)?.message || error || ""),
          });
          return cachedSnapshot.items;
        } finally {
          if (shouldShowBusy) {
            if (pullToRefresh) setLikesRefreshing(false);
            else setLikesLoading(false);
          }
        }
      })().finally(() => {
        if (inFlightLikersLoadRef.current === loadPromise) {
          inFlightLikersLoadRef.current = null;
        }
      });
      inFlightLikersLoadRef.current = loadPromise;
      await loadPromise;
    },
    [photo.id, queryClient, telemetryPrefix, viewerId],
  );

  const handleLike = useCallback(async () => {
    const previousLiked = likedRef.current;
    const previousLikes = likesRef.current;
    const next = !previousLiked;
    const optimisticCount = Math.max(0, previousLikes + (next ? 1 : -1));
    likedRef.current = next;
    likesRef.current = optimisticCount;
    setLiked(next);
    setLikes(optimisticCount);
    patchAlbumCaches({ liked: next, likes: optimisticCount });
    try {
      const { entry } = await queueOrReplaceAlbumLikeToggleAction({
        eventId: photo.eventId,
        ownerId: userData.id,
        photoId: photo.id,
        previousCount: previousLikes,
        previousLiked,
        targetLiked: next,
      });
      subscribeToAlbumLikeToggleAction(entry.id, {
        onFailed: ({ previousCount, previousLiked }) => {
          if (!isMountedRef.current) return;
          likedRef.current = previousLiked;
          likesRef.current = previousCount;
          setLiked(previousLiked);
          setLikes(previousCount);
          patchAlbumCaches({ liked: previousLiked, likes: previousCount });
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          likedRef.current = response.liked;
          likesRef.current = response.count;
          setLiked(response.liked);
          setLikes(response.count);
          patchAlbumCaches({ liked: response.liked, likes: response.count });
          if (showLikesModal) {
            void loadLikers({ pullToRefresh: true });
          }
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId: userData.id,
        queryClient,
      });
    } catch (error) {
      debugWarn("CONTENT-CARDS", `${telemetryPrefix}-like-toggle-queue-failed`, {
        message: String(
          (error as { message?: string } | null)?.message ||
            `${telemetryPrefix}-like-toggle-queue-failed`,
        ),
        photoId: photo.id,
      });
      likedRef.current = previousLiked;
      likesRef.current = previousLikes;
      setLiked(previousLiked);
      setLikes(previousLikes);
      patchAlbumCaches({ liked: previousLiked, likes: previousLikes });
    }
  }, [
    loadLikers,
    patchAlbumCaches,
    photo.eventId,
    photo.id,
    queryClient,
    showLikesModal,
    telemetryPrefix,
    userData.id,
  ]);

  const { handleAddComment, handleToggleCommentLike, loadCommentLikers } =
    useAlbumFeedCardCommentActions({
      commentCount: commentsLoaded ? comments.length : Number(photo.comments || 0),
      eventId: photo.eventId,
      onShowWarning,
      patchCommentCount: (count) => patchAlbumCaches({ comments: count }),
      photoId: photo.id,
      queryClient,
      setComments,
      setCommentsLoaded,
      userData,
      viewerId,
    });
  const { canDeleteComment, handleDeleteComment, handleReportComment } =
    useAlbumFeedCardCommentModeration({
      comments,
      deleteBusy,
      eventOwnerId: photo.clubUserId,
      invalidateAlbumCaches,
      onShowWarning,
      patchCommentCount: (count) => patchAlbumCaches({ comments: count }),
      photoId: photo.id,
      setComments,
      setDeleteBusy,
      userData,
    });

  const previewImages = useMemo(() => {
    const rows =
      Array.isArray(photo.images) && photo.images.length > 0 ? photo.images : [photo.image];
    return rows.map((item) => String(item || "").trim()).filter(Boolean);
  }, [photo.image, photo.images]);

  const commentCount = commentsLoaded ? comments.length : Number(photo.comments || 0);

  return {
    canDeleteComment,
    commentCount,
    comments,
    commentsRefreshing,
    handleAddComment,
    handleDeleteComment,
    handleLike,
    handleReportComment,
    handleToggleCommentLike,
    liked,
    likes,
    likesLoading,
    likesRefreshing,
    likers,
    loadCommentLikers,
    loadLikers,
    previewImages,
    refreshComments,
    userData,
  };
}
