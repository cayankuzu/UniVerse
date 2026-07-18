import { CommentPanel } from "../comments/CommentPanel";
import { UserListSheet } from "../comments/UserListSheet";
import { MediaViewerModal } from "../../../../shared/media/MediaViewerModal";
import type { CommentItem, SearchUserResult } from "../../data";
import { type OverflowActionItem } from "../../../../shared/components";

type DetailCurrentUser = {
  id?: string;
  image: string;
  name: string;
  university: string;
  username: string;
};

interface AlbumDetailInteractionsProps {
  canDeleteComment: (comment: CommentItem) => boolean;
  comments: CommentItem[];
  commentsRefreshing: boolean;
  currentUser: DetailCurrentUser;
  likes: number;
  likesLoading: boolean;
  likesRefreshing: boolean;
  likers: SearchUserResult[];
  loadCommentLikers: (comment: CommentItem) => Promise<SearchUserResult[]>;
  loadLikers: (options?: { pullToRefresh?: boolean }) => Promise<void>;
  onAddComment: (text: string, parentId: string | null) => Promise<void>;
  onCloseComments: () => void;
  onCloseImagePreview: () => void;
  onCloseLikes: () => void;
  onDeleteComment: (comment: CommentItem) => Promise<void> | void;
  onOpenProfile: (username: string) => void;
  onRefreshComments: () => Promise<void>;
  onReportComment: (comment: CommentItem) => Promise<void> | void;
  onToggleCommentLike: (comment: CommentItem) => Promise<void> | void;
  ownerUsername: string;
  previewActions?: OverflowActionItem[];
  previewImages: string[];
  previewIndex: number;
  setPreviewIndex: (value: number) => void;
  showComments: boolean;
  showImagePreview: boolean;
  showLikesModal: boolean;
}

export function AlbumDetailInteractions({
  canDeleteComment,
  comments,
  commentsRefreshing,
  currentUser,
  likes,
  likesLoading,
  likesRefreshing,
  likers,
  loadCommentLikers,
  loadLikers,
  onAddComment,
  onCloseComments,
  onCloseImagePreview,
  onCloseLikes,
  onDeleteComment,
  onOpenProfile,
  onRefreshComments,
  onReportComment,
  onToggleCommentLike,
  ownerUsername,
  previewActions,
  previewImages,
  previewIndex,
  setPreviewIndex,
  showComments,
  showImagePreview,
  showLikesModal,
}: AlbumDetailInteractionsProps) {
  return (
    <>
      {showLikesModal ? (
        <UserListSheet
          visible
          title="Begenenler"
          count={likes}
          users={likers}
          loading={likesLoading}
          refreshing={likesRefreshing}
          emptyText="Henüz beğenen yok."
          onClose={onCloseLikes}
          onRefresh={() => {
            void loadLikers({ pullToRefresh: true });
          }}
          onOpenUser={(username) => {
            onCloseLikes();
            onOpenProfile(username);
          }}
        />
      ) : null}

      {showComments ? (
        <CommentPanel
          visible
          title="Yorumlar"
          comments={comments}
          currentUser={currentUser}
          ownerUsername={ownerUsername}
          canDeleteComment={canDeleteComment}
          onSubmit={onAddComment}
          onToggleCommentLike={onToggleCommentLike}
          onDeleteComment={onDeleteComment}
          onOpenCommentLikes={loadCommentLikers}
          onReportComment={onReportComment}
          onClose={onCloseComments}
          onPressUser={onOpenProfile}
          refreshing={commentsRefreshing}
          onRefresh={onRefreshComments}
        />
      ) : null}

      <MediaViewerModal
        actions={previewActions}
        initialIndex={previewIndex}
        items={previewImages.map((uri) => ({ uri }))}
        onClose={onCloseImagePreview}
        onIndexChange={setPreviewIndex}
        visible={showImagePreview}
      />
    </>
  );
}
