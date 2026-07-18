import React from "react";
import { EventCardBody } from "./EventCardBody";
import { EventCardFooter } from "./EventCardFooter";
import { EventCardHeader } from "./EventCardHeader";
import { EventCardImage } from "./EventCardImage";
import { EventCardModals } from "./EventCardModals";
import { getJoinButtonLabel } from "../../application/eventInteractionPresentation";
import { DeferredHomeEventCard } from "./DeferredHomeEventCard";
import {
  EventCardSurface,
  getAlbumWarningMessage,
  getLocationWarningMessage,
  TEMP_EVENT_WARNING,
} from "./eventCard.shared";
import { useEventCardState } from "./useEventCardState";
import type { HomeEventCardProps } from "./eventCard.types";

export const HomeEventCard = React.memo(function HomeEventCard({
  deferModalActions = false,
  ...props
}: HomeEventCardProps) {
  return deferModalActions ? (
    <DeferredHomeEventCard {...props} />
  ) : (
    <InteractiveHomeEventCard {...props} />
  );
});

const InteractiveHomeEventCard = React.memo(function InteractiveHomeEventCard({
  accountType,
  event,
  highPriority = false,
  imageVariant = "medium",
  presentation,
  onOpenCard,
  onOpenAlbum,
  onOpenClub,
  onShowWarning,
  relations,
  isTourTarget = false,
  interactive = true,
  allowInfoActions = false,
  renderTourAnchor,
  viewer,
}: HomeEventCardProps) {
  const state = useEventCardState({
    accountType,
    allowInfoActions,
    event,
    interactive,
    onShowWarning,
    relations,
    viewer,
  });
  const isTempEvent = String(event.id || "").startsWith("temp-event:");
  const albumWarningMessage = getAlbumWarningMessage(state.eventActionAccess);
  const { eventActionAccess, loadAlbumOpenWarning } = state;
  const locationWarningMessage = getLocationWarningMessage(state.eventActionAccess);
  const handleOpenAlbum = React.useCallback(() => {
    if (!interactive) return;
    if (isTempEvent) {
      onShowWarning?.(TEMP_EVENT_WARNING);
      return;
    }
    void (async () => {
      const blockedMessage = await loadAlbumOpenWarning();
      if (blockedMessage) {
        onShowWarning?.(blockedMessage);
        return;
      }
      if (!eventActionAccess.canOpenAlbum) {
        onShowWarning?.(albumWarningMessage);
        return;
      }
      (onOpenAlbum || onOpenCard)?.(event.id);
    })();
  }, [
    albumWarningMessage,
    event,
    interactive,
    isTempEvent,
    onOpenAlbum,
    onOpenCard,
    onShowWarning,
    loadAlbumOpenWarning,
    eventActionAccess.canOpenAlbum,
  ]);

  return (
    <>
      <EventCardSurface isTourTarget={isTourTarget} renderTourAnchor={renderTourAnchor}>
        <EventCardHeader
          event={event}
          presentation={presentation}
          onPress={interactive ? () => onOpenClub?.(event.clubUsername) : undefined}
        />
        <EventCardImage
          event={event}
          highPriority={highPriority}
          imageVariant={imageVariant}
          onPress={() => {
            if (isTempEvent) {
              onShowWarning?.(TEMP_EVENT_WARNING);
              return;
            }
            if (!event.image) {
              if (interactive) onOpenCard?.(event.id);
              return;
            }
            state.setShowImagePreview(true);
          }}
          onLongPress={() => {
            if (!interactive) return;
            if (isTempEvent) {
              onShowWarning?.(TEMP_EVENT_WARNING);
              return;
            }
            onOpenCard?.(event.id);
          }}
        />
        <EventCardBody
          event={event}
          presentation={presentation}
          attendees={state.attendees}
          isTourTarget={isTourTarget}
          onPressAttendees={
            state.bodyActionsEnabled ? () => void state.handleOpenAttendees() : undefined
          }
          renderTourAnchor={renderTourAnchor}
        />
        <EventCardFooter
          liked={state.liked}
          likes={state.likes}
          onLikeLongPress={
            interactive
              ? () => {
                  void state.handleOpenLikes();
                }
              : undefined
          }
          comments={state.commentCount}
          onLike={state.handleLike}
          onComment={() => {
            if (!interactive) return;
            void state.handleOpenComments();
          }}
          onAlbum={() => {
            handleOpenAlbum();
          }}
          onAlbumDisabledPress={handleOpenAlbum}
          albumDisabled={state.albumDisabled}
          onLocation={
            state.bodyActionsEnabled
              ? () => {
                  state.setShowLocationModal(true);
                }
              : undefined
          }
          onLocationDisabledPress={() => onShowWarning?.(locationWarningMessage)}
          locationDisabled={state.locationDisabled}
          showLocation={state.hasLocation}
          albumCount={Math.max(presentation?.albumCount ?? event.albumCount ?? 0, 0)}
          joined={state.joined}
          onJoin={state.handleJoin}
          onJoinDisabledPress={() => onShowWarning?.(state.joinWarningMessage)}
          joinDisabled={state.joinDisabled}
          joinHardDisabled={state.eventActionAccess.isEnded}
          joinLabelOverride={getJoinButtonLabel(state.eventActionAccess, state.joined)}
          menuActions={interactive ? state.eventMenuActions : []}
          showJoin={interactive && state.accountType === "student"}
          isTourTarget={isTourTarget}
          renderTourAnchor={renderTourAnchor}
        />
      </EventCardSurface>

      <EventCardModals
        event={event}
        comments={state.comments}
        commentsRefreshing={state.commentsRefreshing}
        currentUser={{
          id: viewer.id,
          username: viewer.username,
          name: viewer.name || viewer.clubName || viewer.username,
          image: viewer.profileImage,
          university: viewer.university,
        }}
        canDeleteComment={state.canDeleteComment}
        copiedField={state.copiedField}
        interactive={interactive}
        likers={state.likers}
        likesCount={state.likes}
        likesLoading={state.likesLoading}
        likesRefreshing={state.likesRefreshing}
        attendeesList={state.attendeesList}
        attendeesCount={state.attendees}
        attendeesLoading={state.attendeesLoading}
        attendeesRefreshing={state.attendeesRefreshing}
        bodyActionsEnabled={state.bodyActionsEnabled}
        modalBottomPadding={state.modalBottomPadding}
        onAddComment={state.handleAddComment}
        onCommentLike={state.handleToggleCommentLike}
        onCloseComments={() => state.setShowComments(false)}
        onCloseDeleteConfirm={state.closeDeleteConfirmModal}
        onCloseImagePreview={() => state.setShowImagePreview(false)}
        onCloseLikes={() => state.setShowLikesModal(false)}
        onCloseAttendees={() => state.setShowAttendeesModal(false)}
        onCloseLocation={() => state.setShowLocationModal(false)}
        onCloseReport={() => state.setShowReportModal(false)}
        onCopyText={state.handleCopyText}
        onDeleteComment={state.handleDeleteComment}
        onOpenCommentLikes={state.loadCommentLikers}
        onOpenClub={onOpenClub}
        onReportComment={state.handleReportComment}
        onRefreshComments={() => state.refreshComments(true)}
        onRefreshLikes={() => {
          void state.loadLikers({ pullToRefresh: true });
        }}
        onRefreshAttendees={() => {
          void state.loadAttendees({ pullToRefresh: true });
        }}
        onDeleteEvent={state.handleDeleteEvent}
        onReport={state.handleReport}
        deleteBusy={state.deleteBusy}
        reportSubmitted={state.reportSubmitted}
        showAttendeesModal={state.showAttendeesModal}
        showComments={state.showComments}
        showDeleteConfirmModal={state.showDeleteConfirmModal}
        showImagePreview={state.showImagePreview}
        showLikesModal={state.showLikesModal}
        showLocationModal={state.showLocationModal}
        showReportModal={state.showReportModal}
      />
    </>
  );
});
