import React from "react";
import { CommentPanel } from "../comments/CommentPanel";
import { UserListSheet } from "../comments/UserListSheet";
import { MediaViewerModal } from "../../../../shared/media/MediaViewerModal";
import type { CommentItem, SearchUserResult } from "../../data";
import { type OverflowActionItem } from "../../../../shared/components";

type Props = {
  comments: CommentItem[];
  commentsRefreshing: boolean;
  currentUser: {
    id?: string;
    username: string;
    name: string;
    image?: string;
    university?: string;
  };
  likers: SearchUserResult[];
  likesCount: number;
  likesLoading: boolean;
  likesRefreshing: boolean;
  ownerUsername?: string;
  canDeleteComment: (comment: CommentItem) => boolean;
  onAddComment: (text: string, parentId: string | null) => Promise<void>;
  onCommentLike: (comment: CommentItem) => Promise<void>;
  onCloseComments: () => void;
  onCloseImagePreview: () => void;
  onCloseLikes: () => void;
  onDeleteComment: (comment: CommentItem) => void;
  onOpenCommentLikes: (comment: CommentItem) => Promise<SearchUserResult[]>;
  onOpenUser: (username: string) => void;
  onRefreshComments: () => Promise<void>;
  onRefreshLikes: () => void;
  onReportComment: (comment: CommentItem) => void;
  previewActions?: OverflowActionItem[];
  previewImages: string[];
  previewIndex: number;
  setPreviewIndex: (value: number) => void;
  showComments: boolean;
  showImagePreview: boolean;
  showLikesModal: boolean;
};

export function AlbumCardModals({
  comments,
  commentsRefreshing,
  currentUser,
  likers,
  likesCount,
  likesLoading,
  likesRefreshing,
  ownerUsername,
  canDeleteComment,
  onAddComment,
  onCommentLike,
  onCloseComments,
  onCloseImagePreview,
  onCloseLikes,
  onDeleteComment,
  onOpenCommentLikes,
  onOpenUser,
  onRefreshComments,
  onRefreshLikes,
  onReportComment,
  previewActions,
  previewImages,
  previewIndex,
  setPreviewIndex,
  showComments,
  showImagePreview,
  showLikesModal,
}: Props) {
  return (
    <>
      <UserListSheet
        visible={showLikesModal}
        title="Begenenler"
        count={likesCount}
        users={likers}
        loading={likesLoading}
        refreshing={likesRefreshing}
        emptyText="Henüz beğenen yok."
        onClose={onCloseLikes}
        onOpenUser={(username) => {
          onCloseLikes();
          onOpenUser(username);
        }}
        onRefresh={onRefreshLikes}
      />

      <CommentPanel
        visible={showComments}
        title="Yorumlar"
        comments={comments}
        currentUser={currentUser}
        ownerUsername={ownerUsername}
        canDeleteComment={canDeleteComment}
        onSubmit={onAddComment}
        onToggleCommentLike={onCommentLike}
        onDeleteComment={onDeleteComment}
        onOpenCommentLikes={onOpenCommentLikes}
        onReportComment={onReportComment}
        onClose={onCloseComments}
        onPressUser={onOpenUser}
        refreshing={commentsRefreshing}
        onRefresh={onRefreshComments}
      />

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
