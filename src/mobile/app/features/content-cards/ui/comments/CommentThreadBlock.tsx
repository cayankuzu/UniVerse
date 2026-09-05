import { ChevronDown, ChevronUp } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";
import type { CommentItem } from "../../data";
import { CommentPanelRow } from "./CommentPanelRow";

interface CommentThreadBlockProps {
  comment: CommentItem;
  replies: CommentItem[];
  isExpanded: boolean;
  ownerUsername?: string;
  canDeleteComment?: (comment: CommentItem) => boolean;
  onPressUser?: (username: string) => void;
  onReply: (comment: CommentItem) => void;
  onDeleteComment?: (comment: CommentItem) => Promise<void> | void;
  onReportComment?: (comment: CommentItem) => Promise<void> | void;
  onToggleCommentLike?: (comment: CommentItem) => Promise<void> | void;
  onOpenCommentLikes?: (comment: CommentItem) => Promise<void> | void;
  onToggleReplies: (commentId: string) => void;
}

function isAuthorOwner(comment: CommentItem, ownerUsername?: string) {
  return ownerUsername
    ? String(comment.username || "").toLowerCase() === ownerUsername.toLowerCase()
    : false;
}

export function CommentThreadBlock({
  canDeleteComment,
  comment,
  isExpanded,
  onDeleteComment,
  onOpenCommentLikes,
  onPressUser,
  onReply,
  onReportComment,
  onToggleCommentLike,
  onToggleReplies,
  ownerUsername,
  replies,
}: CommentThreadBlockProps) {
  const visibleReplies = isExpanded ? replies : replies.slice(0, 1);
  const hiddenCount = Math.max(0, replies.length - 1);
  const ToggleIcon = isExpanded ? ChevronUp : ChevronDown;

  return (
    <View
      style={{
        borderRadius: tokens.radius.xl,
        backgroundColor: tokens.colors.surface,
        borderWidth: 1,
        borderColor: withAlpha(tokens.colors.foreground, 0.06),
        padding: tokens.spacing.sm,
        ...tokens.shadow.sm,
      }}
    >
      <CommentPanelRow
        comment={comment}
        isReply={false}
        isOwner={isAuthorOwner(comment, ownerUsername)}
        canDelete={canDeleteComment?.(comment) || false}
        onPressUser={onPressUser}
        onReply={onReply}
        onDeleteComment={onDeleteComment}
        onReportComment={onReportComment}
        onToggleLike={onToggleCommentLike}
        onOpenLikes={onOpenCommentLikes}
      />

      {visibleReplies.length > 0 ? (
        <View
          style={{
            marginTop: tokens.spacing.xs,
            marginLeft: tokens.spacing.lgPlus,
            paddingLeft: tokens.spacing.md,
            borderLeftWidth: 1,
            borderLeftColor: tokens.colors.border,
            gap: tokens.spacing.xs,
          }}
        >
          {visibleReplies.map((reply) => (
            <CommentPanelRow
              key={reply.id}
              comment={reply}
              isReply
              isOwner={isAuthorOwner(reply, ownerUsername)}
              canDelete={canDeleteComment?.(reply) || false}
              onPressUser={onPressUser}
              onReply={onReply}
              onDeleteComment={onDeleteComment}
              onReportComment={onReportComment}
              onToggleLike={onToggleCommentLike}
              onOpenLikes={onOpenCommentLikes}
            />
          ))}
        </View>
      ) : null}

      {replies.length > 1 ? (
        <Pressable
          onPress={() => onToggleReplies(comment.id)}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? "Yanıtları gizle" : `${hiddenCount} yanıtı göster`}
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={tokens.hitSlop.sm}
          style={{
            alignSelf: "flex-start",
            marginLeft: 58,
            marginTop: tokens.spacing.xs,
            minHeight: 34,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.surfaceVariant,
            paddingHorizontal: tokens.spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xsMinus,
          }}
        >
          <ToggleIcon size={14} color={tokens.colors.mutedFg} strokeWidth={2.2} />
          <Text
            style={{
              fontSize: tokens.typography.caption,
              color: tokens.colors.muted,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {isExpanded ? "Yanıtları gizle" : `${hiddenCount} yanıt daha`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
