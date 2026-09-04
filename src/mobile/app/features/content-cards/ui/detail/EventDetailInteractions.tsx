import { CommentPanel } from "../comments/CommentPanel";
import { UserListSheet } from "../comments/UserListSheet";
import { EventDetailImagePreviewModal } from "./EventDetailImagePreviewModal";
import { EventLocationModal } from "../shared/EventLocationModal";
import { EventDetailReportModal } from "./EventDetailReportModal";
import type { CommentItem, EventWithMeta, SearchUserResult } from "../../data";
import { DangerConfirmSheet, type OverflowActionItem } from "../../../../shared/components";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { reportEvent } from "../../data";
import { showErrorAlert } from "../../../../shared/utils/alerts";

type DetailCurrentUser = {
  id?: string;
  image: string;
  name: string;
  university: string;
  username: string;
};

interface EventDetailInteractionsProps {
  attendees: number;
  attendeesList: SearchUserResult[];
  attendeesLoading: boolean;
  attendeesRefreshing: boolean;
  canDeleteComment: (comment: CommentItem) => boolean;
  comments: CommentItem[];
  commentsRefreshing: boolean;
  copiedField: "location" | "address" | null;
  currentUser: DetailCurrentUser;
  event: EventWithMeta;
  likers: SearchUserResult[];
  likes: number;
  likesLoading: boolean;
  likesRefreshing: boolean;
  loadAttendees: (options?: { pullToRefresh?: boolean }) => Promise<void>;
  loadCommentLikers: (comment: CommentItem) => Promise<SearchUserResult[]>;
  loadLikers: (options?: { pullToRefresh?: boolean }) => Promise<void>;
  modalBottomPadding: number;
  onAddComment: (text: string, parentId: string | null) => Promise<void>;
  onCloseAttendees: () => void;
  onCloseComments: () => void;
  onCloseDeleteConfirm: () => void;
  onCloseImagePreview: () => void;
  onCloseLikes: () => void;
  onCloseLocation: () => void;
  onCloseReport: () => void;
  onCopyText: (value: string, field: "location" | "address") => Promise<void>;
  onDeleteEvent: () => Promise<void> | void;
  onDeleteComment: (comment: CommentItem) => Promise<void> | void;
  onOpenClub: (username: string) => void;
  onRefreshComments: () => Promise<void>;
  onReport: (reason: string) => Promise<void>;
  onReportComment: (comment: CommentItem) => Promise<void> | void;
  onToggleCommentLike: (comment: CommentItem) => Promise<void> | void;
  deleteBusy: boolean;
  reportSubmitted: boolean;
  showAttendeesModal: boolean;
  showComments: boolean;
  showDeleteConfirmModal: boolean;
  showImagePreview: boolean;
  showLikesModal: boolean;
  showLocationModal: boolean;
  showReportModal: boolean;
}

export function EventDetailInteractions({
  attendees,
  attendeesList,
  attendeesLoading,
  attendeesRefreshing,
  canDeleteComment,
  comments,
  commentsRefreshing,
  copiedField,
  currentUser,
  event,
  likers,
  likes,
  likesLoading,
  likesRefreshing,
  loadAttendees,
  loadCommentLikers,
  loadLikers,
  modalBottomPadding,
  onAddComment,
  onCloseAttendees,
  onCloseComments,
  onCloseDeleteConfirm,
  onCloseImagePreview,
  onCloseLikes,
  onCloseLocation,
  onCloseReport,
  onCopyText,
  onDeleteEvent,
  onDeleteComment,
  onOpenClub,
  onRefreshComments,
  onReport,
  onReportComment,
  onToggleCommentLike,
  deleteBusy,
  reportSubmitted,
  showAttendeesModal,
  showComments,
  showDeleteConfirmModal,
  showImagePreview,
  showLikesModal,
  showLocationModal,
  showReportModal,
}: EventDetailInteractionsProps) {
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
      {showComments ? (
        <CommentPanel
          visible
          title="Yorumlar"
          comments={comments}
          currentUser={currentUser}
          ownerUsername={event.clubUsername}
          canDeleteComment={canDeleteComment}
          onSubmit={onAddComment}
          onToggleCommentLike={onToggleCommentLike}
          onDeleteComment={onDeleteComment}
          onOpenCommentLikes={loadCommentLikers}
          onReportComment={onReportComment}
          onClose={onCloseComments}
          onPressUser={onOpenClub}
          refreshing={commentsRefreshing}
          onRefresh={onRefreshComments}
        />
      ) : null}

      {showLikesModal ? (
        <UserListSheet
          visible
          title="Begenenler"
          count={likes}
          users={likers}
          loading={likesLoading}
          refreshing={likesRefreshing}
          emptyText="Henüz beğenen yok."
          bottomInset={modalBottomPadding}
          onClose={onCloseLikes}
          onRefresh={() => {
            void loadLikers({ pullToRefresh: true });
          }}
          onOpenUser={(username) => {
            onCloseLikes();
            onOpenClub(username);
          }}
        />
      ) : null}

      {showAttendeesModal ? (
        <UserListSheet
          visible
          title="Katılımcılar"
          count={attendees}
          users={attendeesList}
          loading={attendeesLoading}
          refreshing={attendeesRefreshing}
          emptyText="Henüz katılımcı yok."
          bottomInset={modalBottomPadding}
          onClose={onCloseAttendees}
          onRefresh={() => {
            void loadAttendees({ pullToRefresh: true });
          }}
          onOpenUser={(username) => {
            onCloseAttendees();
            onOpenClub(username);
          }}
        />
      ) : null}

      {showImagePreview ? (
        <EventDetailImagePreviewModal
          actions={previewActions}
          imageUri={event.image}
          onClose={onCloseImagePreview}
          visible
        />
      ) : null}

      {showLocationModal ? (
        <EventLocationModal
          copiedField={copiedField}
          event={event}
          modalBottomPadding={modalBottomPadding}
          onClose={onCloseLocation}
          onCopyText={onCopyText}
          visible
        />
      ) : null}

      {showReportModal ? (
        <EventDetailReportModal
          modalBottomPadding={modalBottomPadding}
          onClose={onCloseReport}
          onReport={onReport}
          reportSubmitted={reportSubmitted}
          visible
        />
      ) : null}

      <DangerConfirmSheet
        busy={deleteBusy}
        confirmLabel="Etkinliği Sil"
        description="Etkinlik sayfasını kapatacaksın. Bu karar etkinlik akışından hemen yansır."
        note="Silinen etkinlik geri alınamaz. Eminsen sadece tek adım kaldı."
        onClose={onCloseDeleteConfirm}
        onConfirm={() => void onDeleteEvent()}
        title="Etkinliği kaldır"
        visible={showDeleteConfirmModal}
        warningItems={[
          "Etkinlik kartı ve detay sayfası kullanıcılardan gizlenir.",
          "Profildeki albüm kartları silinmez, bağımsız kalır.",
          "Katılımcı listesi ve bağlı akış kaydı bu etkinlikten çıkar.",
        ]}
      />
    </>
  );
}
