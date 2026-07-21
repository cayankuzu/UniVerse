import { MessageSquare } from "lucide-react-native";
import type { RefObject } from "react";
import { TextInput, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { AppFlatList } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
import type { CommentItem } from "../../data";
import type { CommentPanelCurrentUser } from "./commentPanel.shared";
import { CommentPanelComposer } from "./CommentPanelComposer";
import { CommentPanelSheetHeader } from "./CommentPanelSheetHeader";
import { CommentThreadBlock } from "./CommentThreadBlock";

interface CommentPanelSheetProps {
  title: string;
  commentCount: number;
  currentUser: CommentPanelCurrentUser;
  ownerUsername?: string;
  topLevelComments: CommentItem[];
  repliesByParentId: Map<string, CommentItem[]>;
  expandedReplies: Set<string>;
  refreshing: boolean;
  replyTo: CommentItem | null;
  inputRef: RefObject<TextInput | null>;
  text: string;
  inputFocused: boolean;
  canSend: boolean;
  submitError: string;
  bottomPadding: number;
  sheetBottomInset: number;
  sheetHeight: number;
  canDeleteComment?: (comment: CommentItem) => boolean;
  onClose: () => void;
  onPressUser?: (username: string) => void;
  onReply: (comment: CommentItem) => void;
  onDeleteComment?: (comment: CommentItem) => Promise<void> | void;
  onReportComment?: (comment: CommentItem) => Promise<void> | void;
  onToggleCommentLike?: (comment: CommentItem) => Promise<void> | void;
  onOpenCommentLikes?: (comment: CommentItem) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onToggleReplies: (commentId: string) => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClearReply: () => void;
  onQuickReaction: (reaction: string) => void;
  onSubmit: () => void;
}

function renderEmptyState() {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: tokens.spacing.xl,
        paddingTop: 76,
        gap: tokens.spacing.sm,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: tokens.radius.pill,
          backgroundColor: tokens.colors.primarySofter,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MessageSquare size={tokens.iconSize["2xl"]} color={tokens.colors.primary} />
      </View>
      <Text
        style={{
          fontSize: tokens.typography.title,
          fontWeight: tokens.fontWeight.extrabold,
          color: tokens.colors.foreground,
          textAlign: "center",
        }}
      >
        Henüz yorum yok
      </Text>
      <Text
        style={{
          fontSize: tokens.typography.body,
          color: tokens.colors.mutedFg,
          textAlign: "center",
          lineHeight: tokens.lineHeight.body,
        }}
      >
        Konuşmayı ilk başlatan sen ol.
      </Text>
    </View>
  );
}

export function CommentPanelSheet({
  bottomPadding,
  canDeleteComment,
  canSend,
  commentCount,
  currentUser,
  expandedReplies,
  inputFocused,
  inputRef,
  onBlur,
  onChangeText,
  onClearReply,
  onClose,
  onDeleteComment,
  onFocus,
  onOpenCommentLikes,
  onPressUser,
  onQuickReaction,
  onRefresh,
  onReply,
  onReportComment,
  onSubmit,
  onToggleCommentLike,
  onToggleReplies,
  ownerUsername,
  refreshing,
  replyTo,
  sheetBottomInset,
  sheetHeight,
  submitError,
  text,
  title,
  topLevelComments,
  repliesByParentId,
}: CommentPanelSheetProps) {
  return (
    <View
      accessibilityLabel={title}
      accessibilityRole="menu"
      accessibilityViewIsModal
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: sheetBottomInset,
        height: sheetHeight,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        backgroundColor: tokens.colors.surface,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.08),
        overflow: "hidden",
      }}
    >
      <CommentPanelSheetHeader title={title} commentCount={commentCount} onClose={onClose} />

      <AppFlatList
        data={topLevelComments}
        estimatedItemSize={132}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, backgroundColor: tokens.colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.md,
          paddingBottom: tokens.spacing.sm,
          gap: tokens.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={renderEmptyState}
        renderItem={({ item }) => {
          return (
            <CommentThreadBlock
              comment={item}
              replies={repliesByParentId.get(item.id) || []}
              isExpanded={expandedReplies.has(item.id)}
              ownerUsername={ownerUsername}
              canDeleteComment={canDeleteComment}
              onPressUser={onPressUser}
              onReply={onReply}
              onDeleteComment={onDeleteComment}
              onReportComment={onReportComment}
              onToggleCommentLike={onToggleCommentLike}
              onOpenCommentLikes={onOpenCommentLikes}
              onToggleReplies={onToggleReplies}
            />
          );
        }}
      />

      <CommentPanelComposer
        currentUser={currentUser}
        replyTo={replyTo}
        inputRef={inputRef}
        text={text}
        inputFocused={inputFocused}
        canSend={canSend}
        submitError={submitError}
        bottomPadding={bottomPadding}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onClearReply={onClearReply}
        onQuickReaction={onQuickReaction}
        onSubmit={onSubmit}
      />
    </View>
  );
}
