import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { getEventActionAccess, type RelationSnapshot } from "../../../data/policies/visibility";
import { loadBlockedEventAlbumWarning } from "../../../data/social/blockedVisibility";
import type { AccountType } from "../../../data/contracts/api";
import { resolveEventAttendeesCount } from "../../../data/content/events/events.attendeeCount";
import { debugWarn } from "../../../platform/logging/logger";
import { useAppTransientActivity } from "../../../shared/feedback/AppTransientActivityContext";
import type { EventWithMeta } from "../data";
import {
  deleteEvent,
  patchEventMutationCaches,
  processContentToggleQueue,
  queueOrReplaceEventAttendanceToggleAction,
  queueOrReplaceEventLikeToggleAction,
  removeEventMutationCaches,
  reportEvent,
  subscribeToEventAttendanceToggleAction,
  subscribeToEventLikeToggleAction,
} from "../data";
import {
  fallbackCommentCount,
  getJoinWarningMessage,
  showJoinDisabled,
} from "./eventInteractionPresentation";
import { resolvePendingEventStatus } from "./useEventPendingCardActions";
import type { OverflowActionItem } from "../../../shared/components";

export function useDeferredEventFeedCardState(params: {
  accountType: AccountType;
  event: EventWithMeta;
  interactive?: boolean;
  onShowWarning?: (message: string) => void;
  ownerId?: string;
  relations?: RelationSnapshot;
  viewerUsername: string;
}) {
  const {
    accountType,
    event,
    interactive = true,
    onShowWarning,
    ownerId,
    relations,
    viewerUsername,
  } = params;
  const queryClient = useQueryClient();
  const { showActivity, updateActivity } = useAppTransientActivity();
  const isMountedRef = useRef(true);
  const likedRef = useRef(Boolean(event.liked));
  const likesRef = useRef(Number(event.likes || 0));
  const joinedRef = useRef(Boolean(event.joined));
  const attendeesRef = useRef(resolveEventAttendeesCount(event.attendees, event.joined));
  const [liked, setLiked] = useState(Boolean(event.liked));
  const [likes, setLikes] = useState(Number(event.likes || 0));
  const [joined, setJoined] = useState(Boolean(event.joined));
  const [attendees, setAttendees] = useState(
    resolveEventAttendeesCount(event.attendees, event.joined),
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const nextLiked = Boolean(event.liked);
    const nextLikes = Number(event.likes || 0);
    const nextJoined = Boolean(event.joined);
    const nextAttendees = resolveEventAttendeesCount(event.attendees, event.joined);
    likedRef.current = nextLiked;
    likesRef.current = nextLikes;
    joinedRef.current = nextJoined;
    attendeesRef.current = nextAttendees;
    setLiked(nextLiked);
    setLikes(nextLikes);
    setJoined(nextJoined);
    setAttendees(nextAttendees);
  }, [event.attendees, event.id, event.joined, event.liked, event.likes]);

  const eventActionAccess = useMemo(
    () => getEventActionAccess(viewerUsername, event, relations),
    [event, relations, viewerUsername],
  );
  const canDeleteEvent = Boolean(ownerId) && String(ownerId) === String(event.clubUserId || "");
  const hasLocation = Boolean(String(event.address || event.location || "").trim());
  const joinDisabled = showJoinDisabled(eventActionAccess, joined);
  const joinWarningMessage = getJoinWarningMessage(eventActionAccess, joined);
  const albumDisabled = interactive && !eventActionAccess.canOpenAlbum;
  const locationDisabled =
    interactive &&
    eventActionAccess.isMembersOnly &&
    !eventActionAccess.isOwnClub &&
    !eventActionAccess.canOpenAlbum;
  const commentCount = fallbackCommentCount(event);
  const pendingStatus = resolvePendingEventStatus(event.id, event.uploadStatus);
  const loadAlbumOpenWarning = useCallback(
    () => loadBlockedEventAlbumWarning(event, ownerId),
    [event, ownerId],
  );

  const patchEventCaches = useCallback(
    (
      patch: Partial<Pick<EventWithMeta, "attendees" | "joined" | "liked" | "likes">> & {
        comments?: number;
      },
    ) => {
      patchEventMutationCaches<EventWithMeta>({
        eventId: event.id,
        patch,
        queryClient,
      });
    },
    [event.id, queryClient],
  );

  const handleLike = useCallback(async () => {
    if (!interactive) return;
    const previousLiked = likedRef.current;
    const previousLikes = likesRef.current;
    const nextLiked = !previousLiked;
    const optimisticLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));
    likedRef.current = nextLiked;
    likesRef.current = optimisticLikes;
    setLiked(nextLiked);
    setLikes(optimisticLikes);
    patchEventCaches({ liked: nextLiked, likes: optimisticLikes });

    try {
      const { entry } = await queueOrReplaceEventLikeToggleAction({
        clientMutationId: createClientMutationId("event-like"),
        eventId: event.id,
        ownerId,
        previousCount: previousLikes,
        previousLiked,
        targetLiked: nextLiked,
      });
      subscribeToEventLikeToggleAction(entry.id, {
        onFailed: ({ previousCount, previousLiked }) => {
          if (!isMountedRef.current) return;
          likedRef.current = previousLiked;
          likesRef.current = previousCount;
          setLiked(previousLiked);
          setLikes(previousCount);
          patchEventCaches({ liked: previousLiked, likes: previousCount });
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          likedRef.current = response.liked;
          likesRef.current = response.count;
          setLiked(response.liked);
          setLikes(response.count);
          patchEventCaches({ liked: response.liked, likes: response.count });
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId,
        queryClient,
      });
    } catch (error) {
      debugWarn("CONTENT-CARDS", "deferred-event-like-toggle-queue-failed", {
        eventId: event.id,
        message: String(
          (error as { message?: string } | null)?.message ||
            "deferred-event-like-toggle-queue-failed",
        ),
      });
      likedRef.current = previousLiked;
      likesRef.current = previousLikes;
      setLiked(previousLiked);
      setLikes(previousLikes);
      patchEventCaches({ liked: previousLiked, likes: previousLikes });
    }
  }, [event.id, interactive, ownerId, patchEventCaches, queryClient]);

  const handleJoin = useCallback(async () => {
    if (!interactive) return;
    if (joinDisabled) {
      onShowWarning?.(joinWarningMessage);
      return;
    }

    const previousJoined = joinedRef.current;
    const previousAttendees = attendeesRef.current;
    const nextJoined = !previousJoined;
    const optimisticAttendees = Math.max(0, previousAttendees + (nextJoined ? 1 : -1));
    joinedRef.current = nextJoined;
    attendeesRef.current = optimisticAttendees;
    setJoined(nextJoined);
    setAttendees(optimisticAttendees);
    patchEventCaches({ attendees: optimisticAttendees, joined: nextJoined });

    try {
      const { entry } = await queueOrReplaceEventAttendanceToggleAction({
        clientMutationId: createClientMutationId("event-attend"),
        eventId: event.id,
        ownerId,
        previousCount: previousAttendees,
        previousJoined,
        targetJoined: nextJoined,
      });
      subscribeToEventAttendanceToggleAction(entry.id, {
        onFailed: ({ previousCount, previousJoined }) => {
          if (!isMountedRef.current) return;
          joinedRef.current = previousJoined;
          const restoredAttendees = resolveEventAttendeesCount(previousCount, previousJoined);
          attendeesRef.current = restoredAttendees;
          setJoined(previousJoined);
          setAttendees(restoredAttendees);
          patchEventCaches({ attendees: restoredAttendees, joined: previousJoined });
          onShowWarning?.(getJoinWarningMessage(eventActionAccess, previousJoined));
        },
        onResolved: (response) => {
          if (!isMountedRef.current) return;
          joinedRef.current = response.joined;
          const resolvedAttendees = resolveEventAttendeesCount(response.count, response.joined);
          attendeesRef.current = resolvedAttendees;
          setJoined(response.joined);
          setAttendees(resolvedAttendees);
          patchEventCaches({ attendees: resolvedAttendees, joined: response.joined });
        },
      });
      void processContentToggleQueue({
        entryId: entry.id,
        ownerId,
        queryClient,
      });
    } catch (error) {
      joinedRef.current = previousJoined;
      const restoredAttendees = resolveEventAttendeesCount(previousAttendees, previousJoined);
      attendeesRef.current = restoredAttendees;
      setJoined(previousJoined);
      setAttendees(restoredAttendees);
      patchEventCaches({ attendees: restoredAttendees, joined: previousJoined });
      onShowWarning?.(getJoinWarningMessage(eventActionAccess, previousJoined, error));
    }
  }, [
    event.id,
    eventActionAccess,
    interactive,
    joinDisabled,
    joinWarningMessage,
    onShowWarning,
    ownerId,
    patchEventCaches,
    queryClient,
  ]);

  const handleReport = useCallback(async (): Promise<void> => {
    if (!interactive) return;
    try {
      await reportEvent({ eventId: event.id, reason: "Uygunsuz içerik" });
      onShowWarning?.("Şikayetiniz alindi.");
    } catch (error) {
      debugWarn("CONTENT-CARDS", "deferred-event-report-failed", {
        eventId: event.id,
        message: String(
          (error as { message?: string } | null)?.message || "deferred-event-report-failed",
        ),
      });
      onShowWarning?.("Şikayet gönderilemedi.");
    }
  }, [event.id, interactive, onShowWarning]);

  const openDeleteConfirmModal = useCallback((): void => {
    if (!interactive || !canDeleteEvent || deleteBusy) return;
    setShowDeleteConfirmModal(true);
  }, [canDeleteEvent, deleteBusy, interactive]);

  const closeDeleteConfirmModal = useCallback((): void => {
    if (deleteBusy) return;
    setShowDeleteConfirmModal(false);
  }, [deleteBusy]);

  const handleDeleteEvent = useCallback(async (): Promise<void> => {
    if (!interactive || !canDeleteEvent || deleteBusy) return;
    setDeleteBusy(true);
    const activityId = showActivity({
      hint: "Etkinlik karti listelerden ve veritabanindan kaldiriliyor.",
      percent: 32,
      stage: "Etkinlik siliniyor",
      title: "Etkinlik silme islemi basladi",
      tone: "info",
    });
    try {
      await deleteEvent(event.id);
      removeEventMutationCaches<typeof event>({
        eventId: event.id,
        queryClient,
      });
      setShowDeleteConfirmModal(false);
      updateActivity(activityId, {
        dismissAfterMs: 1800,
        percent: 100,
        stage: "Etkinlik kaldirildi",
        title: "Etkinlik silindi",
        tone: "success",
      });
    } catch (error) {
      updateActivity(activityId, {
        dismissAfterMs: 2600,
        percent: 100,
        stage: String((error as { message?: string } | null)?.message || "Etkinlik silinemedi."),
        title: "Etkinlik silinemedi",
        tone: "error",
      });
    } finally {
      setDeleteBusy(false);
    }
  }, [canDeleteEvent, deleteBusy, event, interactive, queryClient, showActivity, updateActivity]);

  const eventMenuActions = useMemo(
    (): OverflowActionItem[] =>
      canDeleteEvent
        ? [
            {
              key: "delete",
              label: deleteBusy ? "Siliniyor..." : "Etkinligi Sil",
              destructive: true,
              onPress: openDeleteConfirmModal,
            },
          ]
        : [{ key: "report", label: "Etkinligi Şikayet Et", onPress: () => void handleReport() }],
    [canDeleteEvent, deleteBusy, handleReport, openDeleteConfirmModal],
  );

  return {
    accountType,
    albumDisabled,
    attendees,
    commentCount,
    closeDeleteConfirmModal,
    deleteBusy,
    eventActionAccess,
    eventMenuActions,
    handleDeleteEvent,
    handleJoin,
    handleLike,
    hasLocation,
    joinDisabled,
    joinWarningMessage,
    joined,
    liked,
    loadAlbumOpenWarning,
    likes,
    locationDisabled,
    openDeleteConfirmModal,
    pendingStatus,
    showDeleteConfirmModal,
  };
}
