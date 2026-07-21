import React, { useCallback, useState } from "react";
import { getJoinButtonLabel } from "../../application/eventInteractionPresentation";
import { useDeferredEventFeedCardState } from "../../application/useDeferredEventFeedCardState";
import { EventDetailImagePreviewModal } from "../detail/EventDetailImagePreviewModal";
import { EventCardBody } from "./EventCardBody";
import { EventCardFooter } from "./EventCardFooter";
import { EventCardHeader } from "./EventCardHeader";
import { EventCardImage } from "./EventCardImage";
import { DangerConfirmSheet } from "../../../../shared/components";
import {
  EventCardSurface,
  getAlbumWarningMessage,
  getLocationWarningMessage,
  TEMP_EVENT_WARNING,
} from "./eventCard.shared";
import type { HomeEventCardProps } from "./eventCard.types";

export const DeferredHomeEventCard = React.memo(function DeferredHomeEventCard({
  accountType,
  event,
  highPriority = false,
  imageVariant = "thumbnail",
  presentation,
  onOpenAttendees,
  onOpenCard,
  onOpenAlbum,
  onOpenClub,
  onOpenComments,
  onOpenLikes,
  onOpenLocation,
  onShowWarning,
  relations,
  isTourTarget = false,
  interactive = true,
  renderTourAnchor,
  viewer,
}: HomeEventCardProps) {
  const state = useDeferredEventFeedCardState({
    accountType,
    event,
    interactive,
    onShowWarning,
    ownerId: viewer.id,
    relations,
    viewerUsername: viewer.username,
  });
  const [showImagePreview, setShowImagePreview] = useState(false);
  const isTempEvent = String(event.id || "").startsWith("temp-event:");
  const albumWarningMessage = getAlbumWarningMessage(state.eventActionAccess);
  const { eventActionAccess, loadAlbumOpenWarning } = state;
  const locationWarningMessage = getLocationWarningMessage(state.eventActionAccess);
  const closeImagePreview = useCallback(() => {
    setShowImagePreview(false);
  }, []);
  const handleOpenCard = useCallback(() => {
    if (isTempEvent) {
      onShowWarning?.(TEMP_EVENT_WARNING);
      return;
    }
    onOpenCard?.(event.id);
  }, [event.id, isTempEvent, onOpenCard, onShowWarning]);
  const handleOpenImagePreview = useCallback(() => {
    if (!interactive) {
      handleOpenCard();
      return;
    }
    if (isTempEvent) {
      onShowWarning?.(TEMP_EVENT_WARNING);
      return;
    }
    if (!event.image) {
      handleOpenCard();
      return;
    }
    setShowImagePreview(true);
  }, [event.image, handleOpenCard, interactive, isTempEvent, onShowWarning]);
  const handleOpenComments = useCallback(() => {
    if (onOpenComments) {
      onOpenComments();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenComments]);
  const handleOpenLikes = useCallback(() => {
    if (onOpenLikes) {
      onOpenLikes();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenLikes]);
  const handleOpenAttendees = useCallback(() => {
    if (onOpenAttendees) {
      onOpenAttendees();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenAttendees]);
  const handleOpenLocation = useCallback(() => {
    if (onOpenLocation) {
      onOpenLocation();
      return;
    }
    handleOpenCard();
  }, [handleOpenCard, onOpenLocation]);
  const handleOpenAlbum = useCallback(() => {
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
        onPress={handleOpenImagePreview}
        onLongPress={interactive ? handleOpenCard : undefined}
      />
      <EventCardBody
        event={event}
        presentation={presentation}
        attendees={state.attendees}
        isTourTarget={isTourTarget}
        onPressAttendees={interactive ? handleOpenAttendees : undefined}
        renderTourAnchor={renderTourAnchor}
      />
      <EventCardFooter
        liked={state.liked}
        likes={state.likes}
        onLike={() => {
          void state.handleLike();
        }}
        onLikeLongPress={interactive ? handleOpenLikes : undefined}
        comments={state.commentCount}
        onComment={interactive ? handleOpenComments : handleOpenCard}
        onAlbum={() => {
          handleOpenAlbum();
        }}
        onAlbumDisabledPress={handleOpenAlbum}
        albumDisabled={state.albumDisabled}
        onLocation={state.hasLocation ? handleOpenLocation : undefined}
        onLocationDisabledPress={() => onShowWarning?.(locationWarningMessage)}
        locationDisabled={state.locationDisabled}
        showLocation={state.hasLocation}
        albumCount={Math.max(presentation?.albumCount ?? event.albumCount ?? 0, 0)}
        joined={state.joined}
        onJoin={() => {
          void state.handleJoin();
        }}
        onJoinDisabledPress={() => onShowWarning?.(state.joinWarningMessage)}
        joinDisabled={state.joinDisabled}
        joinHardDisabled={state.eventActionAccess.isEnded}
        joinLabelOverride={getJoinButtonLabel(state.eventActionAccess, state.joined)}
        menuActions={interactive ? state.eventMenuActions : []}
        showJoin={interactive && state.accountType === "student"}
        isTourTarget={isTourTarget}
        renderTourAnchor={renderTourAnchor}
      />
      <EventDetailImagePreviewModal
        imageUri={event.image || undefined}
        onClose={closeImagePreview}
        visible={showImagePreview}
      />
      <DangerConfirmSheet
        busy={state.deleteBusy}
        confirmLabel="Etkinliği Sil"
        description="Etkinlik sayfasını kapatacaksın. Bu karar hemen akış kartına yansır."
        note="Silme işlemi geri alınamaz."
        onClose={state.closeDeleteConfirmModal}
        onConfirm={() => void state.handleDeleteEvent()}
        title="Etkinliği kaldır"
        visible={interactive && state.showDeleteConfirmModal}
        warningItems={[
          "Etkinlik kartı ana sayfa akışından kaldırılır.",
          "Profillerdeki albüm kartları korunur.",
          "Katılımcılar etkinliği artık görmez.",
        ]}
      />
    </EventCardSurface>
  );
});
