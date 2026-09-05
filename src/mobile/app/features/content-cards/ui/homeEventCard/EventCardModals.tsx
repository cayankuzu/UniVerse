import React from "react";
import { CommentPanel } from "../comments/CommentPanel";
import type { CommentItem, EventWithMeta, SearchUserResult } from "../../data";
import { DangerConfirmSheet, type OverflowActionItem } from "../../../../shared/components";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { EventCardImagePreviewModal } from "./EventCardImagePreviewModal";
import { EventLocationModal } from "../shared/EventLocationModal";
import { EventCardReportModal } from "./EventCardReportModal";
import { EventCardUserListModal } from "./EventCardUserListModal";
import { reportEvent } from "../../data";
import { showErrorAlert } from "../../../../shared/utils/alerts";

type Props = {
  event: EventWithMeta;
  comments: CommentItem[];
  commentsRefreshing: boolean;
  currentUser: {
    id?: string;
    username: string;
    name: string;
    image?: string;
    university?: string;
  };
  canDeleteComment: (comment: CommentItem) => boolean;
  copiedField: "location" | "address" | null;
  interactive: boolean;
  likers: SearchUserResult[];
  likesCount: number;
  likesLoading: boolean;
  likesRefreshing: boolean;
  attendeesList: SearchUserResult[];
  attendeesCount: number;
  attendeesLoading: boolean;
  attendeesRefreshing: boolean;
  bodyActionsEnabled: boolean;
  modalBottomPadding: number;
  onAddComment: (text: string, parentId: string | null) => Promise<void>;
  onCommentLike: (comment: CommentItem) => Promise<void>;
  onCloseComments: () => void;
  onCloseDeleteConfirm: () => void;
  onCloseImagePreview: () => void;
  onCloseLikes: () => void;
  onCloseAttendees: () => void;
  onCloseLocation: () => void;
  onCloseReport: () => void;
  onCopyText: (value: string, field: "location" | "address") => Promise<void>;
  onDeleteComment: (comment: CommentItem) => void;
  onOpenCommentLikes: (comment: CommentItem) => Promise<SearchUserResult[]>;
  onOpenClub?: (username: string) => void;
  onReportComment: (comment: CommentItem) => void;
  onRefreshComments: () => Promise<void>;
  onRefreshLikes: () => void;
  onRefreshAttendees: () => void;
  onDeleteEvent: () => Promise<void> | void;
  onReport: (reason: string) => Promise<void>;
  deleteBusy: boolean;
  reportSubmitted: boolean;
  showAttendeesModal: boolean;
  showComments: boolean;
  showDeleteConfirmModal: boolean;
  showImagePreview: boolean;
  showLikesModal: boolean;
  showLocationModal: boolean;
  showReportModal: boolean;
};

export function EventCardModals({
  event,
  comments,
  commentsRefreshing,
  currentUser,
  canDeleteComment,
  copiedField,
  interactive,
  likers,
  likesCount,
  likesLoading,
  likesRefreshing,
  attendeesList,
  attendeesCount,
  attendeesLoading,
  attendeesRefreshing,
  bodyActionsEnabled,
  modalBottomPadding,
  onAddComment,
  onCommentLike,
  onCloseComments,
  onCloseDeleteConfirm,
  onCloseImagePreview,
  onCloseLikes,
  onCloseAttendees,
  onCloseLocation,
  onCloseReport,
  onCopyText,
  onDeleteComment,
  onOpenCommentLikes,
  onOpenClub,
  onReportComment,
  onRefreshComments,
  onRefreshLikes,
  onRefreshAttendees,
  onDeleteEvent,
  onReport,
  deleteBusy,
  reportSubmitted,
  showAttendeesModal,
  showComments,
  showDeleteConfirmModal,
  showImagePreview,
  showLikesModal,
  showLocationModal,
  showReportModal,
}: Props) {
  const normalize = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const isOwnEventMedia =
    Boolean(event.clubUserId || event.clubUsername) &&
    (String(currentUser.id || "") === String(event.clubUserId || "") ||
      normalize(currentUser.username) === normalize(event.clubUsername));
  const previewActions: OverflowActionItem[] = event.image
    ? [
        {
          key: isOwnEventMedia ? "download" : "report",
          label: isOwnEventMedia ? "İndir" : "Şikâyet Et",
          destructive: !isOwnEventMedia,
          onPress: () => {
            void (async () => {
              try {
                if (isOwnEventMedia) {
                  await downloadMediaToGallery({
                    kind: isVideoMediaUri(event.image) ? "video" : "image",
                    uri: event.image,
                  });
                  return;
                }
                await reportEvent({
                  eventId: event.id,
                  reason: "Uygunsuz medya",
                });
              } catch (error) {
                showErrorAlert(
                  String((error as { message?: string } | null)?.message || "İşlem tamamlanamadı."),
                  isOwnEventMedia ? "İndirme başarısız" : "Şikâyet gönderilemedi",
                );
              }
            })();
          },
        },
      ]
    : [];

  return (
    <>
      <CommentPanel
        visible={interactive && showComments}
        title="Yorumlar"
        comments={comments}
        currentUser={currentUser}
        ownerUsername={event.clubUsername}
        canDeleteComment={canDeleteComment}
        onSubmit={onAddComment}
        onToggleCommentLike={onCommentLike}
        onClose={onCloseComments}
        onDeleteComment={onDeleteComment}
        onOpenCommentLikes={onOpenCommentLikes}
        onPressUser={(username) => onOpenClub?.(username)}
        onReportComment={onReportComment}
        refreshing={commentsRefreshing}
        onRefresh={onRefreshComments}
      />

      <EventCardImagePreviewModal
        actions={previewActions}
        imageUri={event.image}
        onClose={onCloseImagePreview}
        visible={showImagePreview}
      />

      <EventCardUserListModal
        visible={interactive && showLikesModal}
        title="Begenenler"
        count={likesCount}
        loading={likesLoading}
        data={likers}
        refreshing={likesRefreshing}
        onClose={onCloseLikes}
        onRefresh={onRefreshLikes}
        onOpenUser={(username) => {
          onCloseLikes();
          onOpenClub?.(username);
        }}
        modalBottomPadding={modalBottomPadding}
        emptyText="Henüz beğenen yok."
      />

      <EventCardUserListModal
        visible={bodyActionsEnabled && showAttendeesModal}
        title="Katılımcılar"
        count={attendeesCount}
        loading={attendeesLoading}
        data={attendeesList}
        refreshing={attendeesRefreshing}
        onClose={onCloseAttendees}
        onRefresh={onRefreshAttendees}
        onOpenUser={(username) => {
          onCloseAttendees();
          onOpenClub?.(username);
        }}
        modalBottomPadding={modalBottomPadding}
        emptyText="Henüz katılımcı yok."
      />

      <EventLocationModal
        copiedField={copiedField}
        event={event}
        modalBottomPadding={modalBottomPadding}
        onClose={onCloseLocation}
        onCopyText={onCopyText}
        visible={bodyActionsEnabled && showLocationModal}
      />

      <EventCardReportModal
        modalBottomPadding={modalBottomPadding}
        onClose={onCloseReport}
        onReport={onReport}
        reportSubmitted={reportSubmitted}
        visible={interactive && showReportModal}
      />

      <DangerConfirmSheet
        busy={deleteBusy}
        confirmLabel="Etkinliği Sil"
        description="Etkinlik sayfasını kapatacaksın. Bu kararı vermeden önce etkisini net gör."
        note="Silinen etkinlik geri yüklenmez. İşlem tamamlandığında ana sayfa kartı kaldırılır."
        onClose={onCloseDeleteConfirm}
        onConfirm={() => void onDeleteEvent()}
        title="Etkinliği kaldır"
        visible={interactive && showDeleteConfirmModal}
        warningItems={[
          "Etkinlik sayfası ve etkinliğe ait akış kartı kaldırılır.",
          "Profillerdeki albüm kartları korunur ve ayrıca silinmez.",
          "Katılımcı akışında bu etkinlik artık görünmez.",
        ]}
      />
    </>
  );
}
