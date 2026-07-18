import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import { useProgressiveHydration } from "../../../../shared/utils/useProgressiveHydration";
import {
  buildEventDetailInfoSlides,
  buildEventDetailMetaChips,
  getAlbumWarningMessage,
  getLocationWarningMessage,
  resolveEventDetailAccessChip,
  TEMP_EVENT_WARNING,
} from "../../application/eventDetailPresentation";
import { getJoinButtonLabel } from "../../application/eventInteractionPresentation";
import { useEventDetailInteractionState } from "../../application/useEventDetailInteractionState";
import type { AccountType, AuthUserData, EventWithMeta, RelationSnapshot } from "../../data";
import { EventDetailContent } from "./EventDetailContent";
import { EventDetailDescription } from "./EventDetailDescription";
import { EventDetailHeader } from "./EventDetailHeader";
import { EventDetailImage } from "./EventDetailImage";
import { EventDetailInteractions } from "./EventDetailInteractions";
import { tokens } from "../../../../shared/theme";

type Props = {
  accountType: AccountType;
  event: EventWithMeta;
  onOpenAlbum: (eventId: string) => void;
  onOpenClub: (username: string) => void;
  onShowWarning?: (message: string) => void;
  relations?: RelationSnapshot;
  viewer: AuthUserData;
};

export function EventDetailCard({
  accountType,
  event,
  onOpenAlbum,
  onOpenClub,
  onShowWarning,
  relations,
  viewer,
}: Props) {
  const state = useEventDetailInteractionState({
    accountType,
    event,
    onShowWarning,
    relations,
    userData: viewer,
  });
  const showSecondaryContent = useProgressiveHydration(event.id);
  const isTempEvent = String(event.id || "").startsWith("temp-event:");
  const albumWarningMessage = getAlbumWarningMessage(state.eventActionAccess);
  const { eventActionAccess, loadAlbumOpenWarning } = state;
  const locationWarningMessage = getLocationWarningMessage(state.eventActionAccess);
  const accessChip = useMemo(() => resolveEventDetailAccessChip(event), [event]);
  const infoSlides = useMemo(
    () =>
      buildEventDetailInfoSlides(
        event,
        event.startDate || event.date || "-",
        event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "-",
      ),
    [event],
  );
  const chips = useMemo(() => buildEventDetailMetaChips(event), [event]);
  const handleOpenAlbum = useCallback(() => {
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
      onOpenAlbum(event.id);
    })();
  }, [
    albumWarningMessage,
    event,
    isTempEvent,
    onOpenAlbum,
    onShowWarning,
    loadAlbumOpenWarning,
    eventActionAccess.canOpenAlbum,
  ]);
  const currentUser = useMemo(
    () => ({
      id: state.userData.id,
      image: state.userData.profileImage,
      name: state.userData.name || state.userData.clubName || state.userData.username,
      university: state.userData.university,
      username: state.userData.username,
    }),
    [
      state.userData.clubName,
      state.userData.id,
      state.userData.name,
      state.userData.profileImage,
      state.userData.university,
      state.userData.username,
    ],
  );
  const shouldRenderInteractions =
    state.showComments ||
    state.showLikesModal ||
    state.showAttendeesModal ||
    state.showImagePreview ||
    state.showLocationModal ||
    state.showReportModal;

  return (
    <>
      <View
        style={{
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: "rgba(15,23,42,0.07)",
        }}
      >
        <EventDetailHeader event={event} onPress={() => onOpenClub(event.clubUsername)} />

        <EventDetailImage
          event={event}
          imageVariant="medium"
          onPress={() => {
            if (isTempEvent) {
              onShowWarning?.(TEMP_EVENT_WARNING);
              return;
            }
            if (!event.image) return;
            state.setShowImagePreview(true);
          }}
          onLongPress={() => {
            if (isTempEvent || !event.image) return;
            state.setShowImagePreview(true);
          }}
        />

        <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
          <Text
            style={{
              fontSize: tokens.typography.title,
              fontWeight: tokens.fontWeight.extrabold,
              color: tokens.colors.foreground,
              lineHeight: 28,
            }}
          >
            {event.title}
          </Text>

          <EventDetailDescription description={event.description || ""} />

          <EventDetailContent
            accessChip={accessChip}
            albumCount={Math.max(
              (event as EventWithMeta & { albumCount?: number }).albumCount || 0,
              0,
            )}
            albumDisabled={state.albumDisabled}
            albumWarningMessage={albumWarningMessage}
            attendees={state.attendees}
            bodyActionsEnabled={state.bodyActionsEnabled}
            capacity={Math.max(event.capacity || 1, 1)}
            chips={chips}
            commentCount={state.commentCount}
            hasLocation={state.hasLocation}
            infoSlides={infoSlides}
            joinDisabled={state.joinDisabled}
            joinHardDisabled={state.eventActionAccess.isEnded}
            joinLabel={
              getJoinButtonLabel(state.eventActionAccess, state.joined) ||
              (state.joined ? "Katildin" : "Katil")
            }
            menuActions={state.eventMenuActions}
            joinWarningMessage={state.joinWarningMessage}
            joined={state.joined}
            liked={state.liked}
            likes={state.likes}
            locationDisabled={state.locationDisabled}
            locationWarningMessage={locationWarningMessage}
            onJoin={state.handleJoin}
            onLike={state.handleLike}
            onOpenAlbum={handleOpenAlbum}
            onAlbumDisabledPress={handleOpenAlbum}
            onOpenAttendees={() => {
              void state.handleOpenAttendees();
            }}
            onOpenComments={() => {
              void state.handleOpenComments();
            }}
            onOpenLikes={() => {
              void state.handleOpenLikes();
            }}
            onOpenLocation={() => state.setShowLocationModal(true)}
            onShowWarning={onShowWarning}
            showJoin={accountType === "student"}
            showSecondaryContent={showSecondaryContent}
          />
        </View>
      </View>

      {shouldRenderInteractions ? (
        <EventDetailInteractions
          attendees={state.attendees}
          attendeesList={state.attendeesList}
          attendeesLoading={state.attendeesLoading}
          attendeesRefreshing={state.attendeesRefreshing}
          canDeleteComment={state.canDeleteComment}
          comments={state.comments}
          commentsRefreshing={state.commentsRefreshing}
          copiedField={state.copiedField}
          currentUser={currentUser}
          event={event}
          likers={state.likers}
          likes={state.likes}
          likesLoading={state.likesLoading}
          likesRefreshing={state.likesRefreshing}
          loadAttendees={state.loadAttendees}
          loadCommentLikers={state.loadCommentLikers}
          loadLikers={state.loadLikers}
          modalBottomPadding={state.modalBottomPadding}
          onAddComment={state.handleAddComment}
          onCloseAttendees={() => state.setShowAttendeesModal(false)}
          onCloseComments={() => state.setShowComments(false)}
          onCloseDeleteConfirm={state.closeDeleteConfirmModal}
          onCloseImagePreview={() => state.setShowImagePreview(false)}
          onCloseLikes={() => state.setShowLikesModal(false)}
          onCloseLocation={() => state.setShowLocationModal(false)}
          onCloseReport={() => state.setShowReportModal(false)}
          onCopyText={state.handleCopyText}
          onDeleteEvent={state.handleDeleteEvent}
          onDeleteComment={state.handleDeleteComment}
          onOpenClub={onOpenClub}
          onRefreshComments={() => state.refreshComments(true)}
          onReport={state.handleReport}
          onReportComment={state.handleReportComment}
          onToggleCommentLike={state.handleToggleCommentLike}
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
      ) : null}
    </>
  );
}
