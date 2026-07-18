import { useEffect, useRef } from "react";
import type {
  AccountType,
  AlbumPhotoWithMeta,
  ContentViewer,
  EventWithMeta,
  RelationSnapshot,
} from "../../data";
import { EventCardModals } from "../homeEventCard/EventCardModals";
import { useEventCardState } from "../homeEventCard/useEventCardState";
import { AlbumCardModals } from "./AlbumCardModals";
import { useAlbumFeedCardState } from "./useAlbumFeedCardState";

type HomeFeedOverlayState =
  | {
      kind: "event";
      panel: "attendees" | "comments" | "likes" | "location";
      event: EventWithMeta;
      relations?: RelationSnapshot;
    }
  | {
      kind: "album";
      panel: "comments" | "likes";
      photo: AlbumPhotoWithMeta;
      relations?: RelationSnapshot;
    }
  | null;

type Props = {
  accountType: AccountType;
  activeOverlay: HomeFeedOverlayState;
  currentUsername: string;
  onDismiss: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenProfile: (username: string) => void;
  onShowWarning?: (message: string) => void;
  viewer: ContentViewer;
};

type EventOverlayState = Extract<Exclude<HomeFeedOverlayState, null>, { kind: "event" }>;
type AlbumOverlayState = Extract<Exclude<HomeFeedOverlayState, null>, { kind: "album" }>;

function useOverlayBootstrap(key: string, action: () => void) {
  const openedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (openedKeyRef.current === key) return;
    openedKeyRef.current = key;
    action();
  }, [action, key]);
}

function HomeFeedEventOverlay({
  accountType,
  event,
  onDismiss,
  onOpenProfile,
  onShowWarning,
  panel,
  relations,
  viewer,
}: EventOverlayState & {
  accountType: AccountType;
  onDismiss: () => void;
  onOpenProfile: (username: string) => void;
  onShowWarning?: (message: string) => void;
  viewer: ContentViewer;
}) {
  const state = useEventCardState({
    accountType,
    event,
    interactive: true,
    onShowWarning,
    relations,
    viewer,
  });
  const overlayKey = `event:${event.id}:${panel}`;

  useOverlayBootstrap(overlayKey, () => {
    if (panel === "comments") {
      void state.handleOpenComments();
      return;
    }
    if (panel === "likes") {
      void state.handleOpenLikes();
      return;
    }
    if (panel === "location") {
      state.setShowLocationModal(true);
      return;
    }
    void state.handleOpenAttendees();
  });

  return (
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
      interactive
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
      onCloseComments={() => {
        state.setShowComments(false);
        onDismiss();
      }}
      onCloseDeleteConfirm={state.closeDeleteConfirmModal}
      onCloseImagePreview={() => state.setShowImagePreview(false)}
      onCloseLikes={() => {
        state.setShowLikesModal(false);
        onDismiss();
      }}
      onCloseAttendees={() => {
        state.setShowAttendeesModal(false);
        onDismiss();
      }}
      onCloseLocation={() => state.setShowLocationModal(false)}
      onCloseReport={() => state.setShowReportModal(false)}
      onCopyText={state.handleCopyText}
      onDeleteComment={state.handleDeleteComment}
      onOpenCommentLikes={state.loadCommentLikers}
      onOpenClub={(username) => {
        onDismiss();
        onOpenProfile(username);
      }}
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
  );
}

function HomeFeedAlbumOverlay({
  currentUsername,
  onDismiss,
  onOpenEvent,
  onOpenProfile,
  onShowWarning,
  photo,
  relations,
  panel,
  viewer,
}: AlbumOverlayState & {
  currentUsername: string;
  onDismiss: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenProfile: (username: string) => void;
  onShowWarning?: (message: string) => void;
  viewer: ContentViewer;
}) {
  const state = useAlbumFeedCardState({
    context: "feed",
    currentUsername,
    onOpenClub: onOpenProfile,
    onOpenEvent,
    onShowWarning,
    photo,
    relations,
    viewer,
  });
  const overlayKey = `album:${photo.id}:${panel}`;

  useOverlayBootstrap(overlayKey, () => {
    if (panel === "comments") {
      void state.handleOpenComments();
      return;
    }
    void state.handleOpenLikes();
  });

  return (
    <AlbumCardModals
      comments={state.comments}
      commentsRefreshing={state.commentsRefreshing}
      currentUser={{
        id: viewer.id,
        username: viewer.username,
        name: viewer.name || viewer.clubName || viewer.username,
        image: viewer.profileImage,
        university: viewer.university,
      }}
      likers={state.likers}
      likesCount={state.likes}
      likesLoading={state.likesLoading}
      likesRefreshing={state.likesRefreshing}
      ownerUsername={photo.username}
      canDeleteComment={state.canDeleteComment}
      onAddComment={state.handleAddComment}
      onCommentLike={state.handleToggleCommentLike}
      onCloseComments={() => {
        state.setShowComments(false);
        onDismiss();
      }}
      onCloseImagePreview={() => state.setShowImagePreview(false)}
      onCloseLikes={() => {
        state.setShowLikesModal(false);
        onDismiss();
      }}
      onDeleteComment={state.handleDeleteComment}
      onOpenCommentLikes={state.loadCommentLikers}
      onOpenUser={(username) => {
        onDismiss();
        onOpenProfile(username);
      }}
      onRefreshComments={state.refreshComments}
      onRefreshLikes={() => {
        void state.loadLikers({ pullToRefresh: true });
      }}
      onReportComment={state.handleReportComment}
      previewImages={state.previewImages}
      previewIndex={state.previewIndex}
      setPreviewIndex={state.setPreviewIndex}
      showComments={state.showComments}
      showImagePreview={state.showImagePreview}
      showLikesModal={state.showLikesModal}
    />
  );
}

export function HomeFeedInteractionOverlay({
  accountType,
  activeOverlay,
  currentUsername,
  onDismiss,
  onOpenEvent,
  onOpenProfile,
  onShowWarning,
  viewer,
}: Props) {
  if (!activeOverlay) return null;

  return activeOverlay.kind === "event" ? (
    <HomeFeedEventOverlay
      key={`${activeOverlay.kind}:${activeOverlay.event.id}:${activeOverlay.panel}`}
      accountType={accountType}
      {...activeOverlay}
      onDismiss={onDismiss}
      onOpenProfile={onOpenProfile}
      onShowWarning={onShowWarning}
      viewer={viewer}
    />
  ) : (
    <HomeFeedAlbumOverlay
      key={`${activeOverlay.kind}:${activeOverlay.photo.id}:${activeOverlay.panel}`}
      {...activeOverlay}
      currentUsername={currentUsername}
      onDismiss={onDismiss}
      onOpenEvent={onOpenEvent}
      onOpenProfile={onOpenProfile}
      onShowWarning={onShowWarning}
      viewer={viewer}
    />
  );
}
