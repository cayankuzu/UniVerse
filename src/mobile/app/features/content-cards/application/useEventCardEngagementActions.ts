import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { resolveEventAttendeesCount } from "../../../data/content/events/events.attendeeCount";
import { debugWarn } from "../../../platform/logging/logger";
import {
  processContentToggleQueue,
  queueOrReplaceEventAttendanceToggleAction,
  queueOrReplaceEventLikeToggleAction,
  subscribeToEventAttendanceToggleAction,
  subscribeToEventLikeToggleAction,
} from "../data";
import { getJoinWarningMessage, showJoinDisabled } from "./eventInteractionPresentation";

export function useEventCardEngagementActions(params: {
  attendees: number;
  eventActionAccess: unknown;
  eventId: string;
  interactive: boolean;
  joined: boolean;
  liked: boolean;
  likes: number;
  loadAttendees: (options?: { pullToRefresh?: boolean }) => Promise<void>;
  loadLikers: (options?: { pullToRefresh?: boolean }) => Promise<void>;
  ownerId?: string;
  onShowWarning?: (message: string) => void;
  patchEventCaches: (patch: {
    attendees?: number;
    joined?: boolean;
    liked?: boolean;
    likes?: number;
  }) => void;
  setAttendees: (value: number) => void;
  setJoined: (value: boolean) => void;
  setLiked: (value: boolean) => void;
  setLikes: (value: number) => void;
  showAttendeesModal: boolean;
  showLikesModal: boolean;
}) {
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const handleLike = useCallback(async () => {
    if (!params.interactive) return;

    const next = !params.liked;
    const optimisticCount = Math.max(0, params.likes + (next ? 1 : -1));
    params.setLiked(next);
    params.setLikes(optimisticCount);
    params.patchEventCaches({ liked: next, likes: optimisticCount });

    try {
      const { entry } = await queueOrReplaceEventLikeToggleAction({
        clientMutationId: createClientMutationId("event-like"),
        eventId: params.eventId,
        ownerId: params.ownerId,
        previousCount: params.likes,
        previousLiked: params.liked,
        targetLiked: next,
      });
      subscribeToEventLikeToggleAction(entry.id, {
        onFailed: ({ previousCount, previousLiked }) => {
          if (!isMountedRef.current) return;
          params.setLiked(previousLiked);
          params.setLikes(previousCount);
          params.patchEventCaches({ liked: previousLiked, likes: previousCount });
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          params.setLiked(response.liked);
          params.setLikes(response.count);
          params.patchEventCaches({ liked: response.liked, likes: response.count });
          if (params.showLikesModal) {
            void params.loadLikers({ pullToRefresh: true });
          }
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId: params.ownerId,
        queryClient,
      });
    } catch (error) {
      debugWarn("CONTENT-CARDS", "event-like-toggle-queue-failed", {
        eventId: params.eventId,
        message: String(
          (error as { message?: string } | null)?.message || "event-like-toggle-queue-failed",
        ),
      });
      params.setLiked(params.liked);
      params.setLikes(params.likes);
      params.patchEventCaches({ liked: params.liked, likes: params.likes });
    }
  }, [params, queryClient]);

  const handleJoin = useCallback(async () => {
    if (!params.interactive) return;
    if (showJoinDisabled(params.eventActionAccess as never, params.joined)) {
      params.onShowWarning?.(
        getJoinWarningMessage(params.eventActionAccess as never, params.joined),
      );
      return;
    }

    const next = !params.joined;
    const optimisticCount = Math.max(0, params.attendees + (next ? 1 : -1));
    params.setJoined(next);
    params.setAttendees(optimisticCount);
    params.patchEventCaches({ joined: next, attendees: optimisticCount });

    try {
      const { entry } = await queueOrReplaceEventAttendanceToggleAction({
        clientMutationId: createClientMutationId("event-attend"),
        eventId: params.eventId,
        ownerId: params.ownerId,
        previousCount: params.attendees,
        previousJoined: params.joined,
        targetJoined: next,
      });
      subscribeToEventAttendanceToggleAction(entry.id, {
        onFailed: ({ previousCount, previousJoined }) => {
          if (!isMountedRef.current) return;
          const restoredAttendees = resolveEventAttendeesCount(previousCount, previousJoined);
          params.setJoined(previousJoined);
          params.setAttendees(restoredAttendees);
          params.patchEventCaches({ joined: previousJoined, attendees: restoredAttendees });
          params.onShowWarning?.(
            getJoinWarningMessage(params.eventActionAccess as never, previousJoined),
          );
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          const resolvedAttendees = resolveEventAttendeesCount(response.count, response.joined);
          params.setJoined(response.joined);
          params.setAttendees(resolvedAttendees);
          params.patchEventCaches({ joined: response.joined, attendees: resolvedAttendees });
          if (params.showAttendeesModal) {
            void params.loadAttendees({ pullToRefresh: true });
          }
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId: params.ownerId,
        queryClient,
      });
    } catch (error) {
      const restoredAttendees = resolveEventAttendeesCount(params.attendees, params.joined);
      params.setJoined(params.joined);
      params.setAttendees(restoredAttendees);
      params.patchEventCaches({ joined: params.joined, attendees: restoredAttendees });
      params.onShowWarning?.(
        getJoinWarningMessage(params.eventActionAccess as never, params.joined, error),
      );
    }
  }, [params, queryClient]);

  return {
    handleJoin,
    handleLike,
  };
}
