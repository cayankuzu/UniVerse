import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEventActionAccess, type RelationSnapshot } from "../../../data/policies/visibility";
import type { AccountType } from "../../../data/contracts/api";
import type { AuthUserData } from "../../../data/contracts/entities";
import { resolveEventAttendeesCount } from "../../../data/content/events/events.attendeeCount";
import { loadBlockedEventAlbumWarning } from "../../../data/social/blockedVisibility";
import type { CommentItem, EventWithMeta, SearchUserResult } from "../data";
import { patchEventMutationCaches, refreshEventMutationScopes } from "../data";
import {
  fallbackCommentCount,
  getJoinWarningMessage,
  showJoinDisabled,
} from "./eventInteractionPresentation";
import { useEventCardCommentActions } from "./useEventCardCommentActions";
import { useEventCardEngagementActions } from "./useEventCardEngagementActions";
import { useEventCardProjectionLoaders } from "./useEventCardProjectionLoaders";
import { useEventModerationActions } from "./useEventModerationActions";
import { useEventPendingCardActions } from "./useEventPendingCardActions";
import { useEventDetailUiState } from "./useEventDetailUiState";

interface UseEventDetailInteractionStateParams {
  accountType: AccountType;
  event: EventWithMeta;
  onShowWarning?: (message: string) => void;
  relations?: RelationSnapshot;
  userData: AuthUserData;
}

export function useEventDetailInteractionState({
  accountType,
  event,
  onShowWarning,
  relations,
  userData,
}: UseEventDetailInteractionStateParams) {
  const queryClient = useQueryClient();
  const viewerId = userData.id;
  const interactive = true;
  const ui = useEventDetailUiState({
    resetKey: event.id,
  });
  const bodyActionsEnabled = true;
  const hasLocation = !!String(event.address || event.location || "").trim();
  const [liked, setLiked] = useState(Boolean(event.liked));
  const [likes, setLikes] = useState(event.likes || 0);
  const [joined, setJoined] = useState(Boolean(event.joined));
  const [attendees, setAttendees] = useState(
    resolveEventAttendeesCount(event.attendees, event.joined),
  );
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsRefreshing, setCommentsRefreshing] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [likesRefreshing, setLikesRefreshing] = useState(false);
  const [attendeesRefreshing, setAttendeesRefreshing] = useState(false);
  const [likers, setLikers] = useState<SearchUserResult[]>([]);
  const [attendeesList, setAttendeesList] = useState<SearchUserResult[]>([]);

  const eventActionAccess = useMemo(
    () => getEventActionAccess(userData.username, event, relations),
    [event, relations, userData.username],
  );
  const canDeleteEvent =
    Boolean(userData.id) && String(userData.id) === String(event.clubUserId || "");
  const joinDisabled = showJoinDisabled(eventActionAccess, joined);
  const joinWarningMessage = getJoinWarningMessage(eventActionAccess, joined);
  const albumDisabled = !eventActionAccess.canOpenAlbum;
  const locationDisabled =
    eventActionAccess.isMembersOnly &&
    !eventActionAccess.isOwnClub &&
    !eventActionAccess.canOpenAlbum;
  const commentCount = commentsLoaded
    ? comments.length
    : Math.max(comments.length, fallbackCommentCount(event));
  const loadAlbumOpenWarning = useCallback(
    () => loadBlockedEventAlbumWarning(event, userData.id),
    [event, userData.id],
  );

  useEffect(() => {
    setLiked(Boolean(event.liked));
    setLikes(event.likes || 0);
    setJoined(Boolean(event.joined));
    setAttendees(resolveEventAttendeesCount(event.attendees, event.joined));
  }, [event.attendees, event.joined, event.liked, event.likes, event.id]);

  useEffect(() => {
    setComments([]);
    setCommentsLoaded(false);
    setCommentsRefreshing(false);
    setLikers([]);
    setAttendeesList([]);
    setLikesLoading(false);
    setAttendeesLoading(false);
    setLikesRefreshing(false);
    setAttendeesRefreshing(false);
  }, [event.id]);

  const patchEventCaches = useCallback(
    (patch: {
      attendees?: number;
      comments?: number;
      joined?: boolean;
      liked?: boolean;
      likes?: number;
    }) => {
      patchEventMutationCaches<typeof event>({
        eventId: event.id,
        patch,
        queryClient,
      });
    },
    [event, queryClient],
  );

  const { loadAttendees, loadLikers, refreshComments } = useEventCardProjectionLoaders({
    bodyActionsEnabled,
    commentsLoaded,
    eventActionAccess,
    eventId: event.id,
    interactive,
    onShowWarning,
    setAttendeesCount: setAttendees,
    setAttendeesList,
    setAttendeesLoading,
    setAttendeesRefreshing,
    setComments,
    setCommentsLoaded,
    setCommentsRefreshing,
    setLikers,
    setLikesLoading,
    setLikesRefreshing,
    viewerId,
  });
  const { handleJoin, handleLike } = useEventCardEngagementActions({
    attendees,
    eventActionAccess,
    eventId: event.id,
    interactive,
    joined,
    liked,
    likes,
    loadAttendees,
    loadLikers,
    ownerId: userData.id,
    onShowWarning,
    patchEventCaches,
    setAttendees,
    setJoined,
    setLiked,
    setLikes,
    showAttendeesModal: ui.showAttendeesModal,
    showLikesModal: ui.showLikesModal,
  });
  const { handleAddComment, handleToggleCommentLike, loadCommentLikers } =
    useEventCardCommentActions({
      commentCount,
      comments,
      eventId: event.id,
      interactive,
      onShowWarning,
      patchCommentCount: (count) => patchEventCaches({ comments: count }),
      queryClient,
      setComments,
      setCommentsLoaded,
      userData,
      viewerId,
    });

  const moderation = useEventModerationActions({
    canDeleteEvent,
    comments,
    event,
    interactive,
    invalidateEventCaches: () => refreshEventMutationScopes(queryClient, event.id),
    onShowWarning,
    patchEventCaches,
    queryClient,
    setComments,
    userId: userData.id,
  });
  const pending = useEventPendingCardActions({
    eventId: event.id,
    uploadStatus: event.uploadStatus,
  });

  const handleOpenComments = useCallback(async () => {
    ui.setShowComments(true);
    await refreshComments(false);
  }, [refreshComments, ui]);

  const handleOpenLikes = useCallback(async () => {
    ui.setShowLikesModal(true);
    await loadLikers();
  }, [loadLikers, ui]);

  const handleOpenAttendees = useCallback(async () => {
    if (!bodyActionsEnabled) return;
    ui.setShowAttendeesModal(true);
    await loadAttendees();
  }, [bodyActionsEnabled, loadAttendees, ui]);

  return {
    ...pending,
    ...ui,
    accountType,
    albumDisabled,
    attendees,
    attendeesList,
    attendeesLoading,
    attendeesRefreshing,
    bodyActionsEnabled,
    canDeleteComment: moderation.canDeleteComment,
    commentCount,
    comments,
    commentsRefreshing,
    closeDeleteConfirmModal: moderation.closeDeleteConfirmModal,
    deleteBusy: moderation.deleteBusy,
    eventActionAccess,
    eventMenuActions: moderation.eventMenuActions,
    handleAddComment,
    handleDeleteComment: moderation.handleDeleteComment,
    handleDeleteEvent: moderation.handleDeleteEvent,
    handleJoin,
    handleLike,
    handleOpenAttendees,
    handleOpenComments,
    handleOpenLikes,
    handleReport: moderation.handleReport,
    handleReportComment: moderation.handleReportComment,
    handleToggleCommentLike,
    hasLocation,
    joined,
    joinDisabled,
    joinWarningMessage,
    liked,
    loadAlbumOpenWarning,
    likes,
    likesLoading,
    likesRefreshing,
    likers,
    loadAttendees,
    loadCommentLikers,
    loadLikers,
    locationDisabled,
    refreshComments,
    reportSubmitted: moderation.reportSubmitted,
    showDeleteConfirmModal: moderation.showDeleteConfirmModal,
    setShowReportModal: moderation.setShowReportModal,
    showReportModal: moderation.showReportModal,
    userData,
  };
}
