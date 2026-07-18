import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback } from "react";

import type { CommentItem, SearchUserResult } from "../../data";
import { getCommentLikeCount } from "../../domain/commentPanel.helpers";
import type { CommentPanelCurrentUser } from "./commentPanel.shared";
import { CommentPanelSheet } from "./CommentPanelSheet";
import { UserListSheet } from "./UserListSheet";
import { useCommentPanelState } from "./useCommentPanelState";
import { tokens } from "../../../../shared/theme";
import { AppModalHost } from "../../../../shared/components";

interface CommentPanelProps {
  visible: boolean;
  title?: string;
  comments: CommentItem[];
  currentUser: CommentPanelCurrentUser;
  ownerUsername?: string;
  canDeleteComment?: (comment: CommentItem) => boolean;
  onSubmit: (text: string, parentId: string | null) => Promise<void> | void;
  onDeleteComment?: (comment: CommentItem) => Promise<void> | void;
  onReportComment?: (comment: CommentItem) => Promise<void> | void;
  onToggleCommentLike?: (comment: CommentItem) => Promise<void> | void;
  onOpenCommentLikes?: (comment: CommentItem) => Promise<SearchUserResult[]> | SearchUserResult[];
  onClose: () => void;
  onPressUser?: (username: string) => void;
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function CommentPanel({
  visible,
  title = "Yorumlar",
  comments,
  currentUser,
  ownerUsername,
  canDeleteComment,
  onSubmit,
  onDeleteComment,
  onReportComment,
  onToggleCommentLike,
  onOpenCommentLikes,
  onClose,
  onPressUser,
  refreshing = false,
  onRefresh,
}: CommentPanelProps) {
  const insets = useSafeAreaInsets();
  const state = useCommentPanelState({
    comments,
    onOpenCommentLikes,
    onSubmit,
    visible,
  });
  const handlePressUser = useCallback(
    (username: string) => {
      const normalizedUsername = String(username || "")
        .trim()
        .replace(/^@+/, "");
      if (!normalizedUsername) return;
      onClose();
      requestAnimationFrame(() => {
        onPressUser?.(normalizedUsername);
      });
    },
    [onClose, onPressUser],
  );

  return (
    <>
      <AppModalHost
        accessibilityAnnouncement="Yorumlar"
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityLabel="Yorum panelini kapat"
            accessibilityRole="button"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(2,6,23,0.38)",
            }}
            onPress={onClose}
          />
          <CommentPanelSheet
            title={title}
            commentCount={state.normalizedCommentCount}
            currentUser={currentUser}
            ownerUsername={ownerUsername}
            topLevelComments={state.topLevelComments}
            repliesByParentId={state.repliesByParentId}
            expandedReplies={state.expandedReplies}
            refreshing={refreshing}
            replyTo={state.replyTo}
            inputRef={state.inputRef}
            text={state.text}
            inputFocused={state.inputFocused}
            canSend={state.canSend}
            submitError={state.submitError}
            bottomPadding={state.composerBottomPadding}
            sheetBottomInset={state.sheetBottomInset}
            sheetHeight={state.sheetHeight}
            canDeleteComment={canDeleteComment}
            onClose={onClose}
            onPressUser={handlePressUser}
            onReply={state.handleReply}
            onDeleteComment={onDeleteComment}
            onReportComment={onReportComment}
            onToggleCommentLike={onToggleCommentLike}
            onOpenCommentLikes={state.likesSheet.openCommentLikes}
            onRefresh={onRefresh}
            onToggleReplies={state.toggleReplies}
            onChangeText={state.setText}
            onFocus={() => state.setInputFocused(true)}
            onBlur={() => state.setInputFocused(false)}
            onClearReply={() => {
              state.setReplyTo(null);
              state.setText("");
            }}
            onQuickReaction={state.handleQuickReaction}
            onSubmit={() => {
              void state.submit();
            }}
          />
        </View>
      </AppModalHost>

      <UserListSheet
        visible={state.likesSheet.commentLikesVisible}
        title="Yorumu Beğenenler"
        count={
          state.likesSheet.commentLikesComment
            ? getCommentLikeCount(state.likesSheet.commentLikesComment)
            : state.likesSheet.commentLikesUsers.length
        }
        users={state.likesSheet.commentLikesUsers}
        loading={state.likesSheet.commentLikesLoading}
        refreshing={state.likesSheet.commentLikesRefreshing}
        emptyText="Bu yorumu henüz kimse beğenmedi."
        bottomInset={Math.max(insets.bottom, tokens.spacing.sm)}
        onClose={() => state.likesSheet.setCommentLikesVisible(false)}
        onRefresh={() => {
          void state.likesSheet.refreshCommentLikes();
        }}
        onOpenUser={(username) => {
          state.likesSheet.setCommentLikesVisible(false);
          handlePressUser(username);
        }}
      />
    </>
  );
}
