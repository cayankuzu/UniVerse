import { Heart, MessageCircle } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Avatar, OverflowActionMenu } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import { formatAbsoluteDateTime } from "../../../../shared/utils/dateTime";
import type { CommentItem } from "../../data";

function formatName(comment: CommentItem) {
  return comment.name || comment.username || "Kullanıcı";
}

function getCommentLikeCount(comment: CommentItem): number {
  const raw =
    (comment as CommentItem & { likesCount?: unknown; like_count?: unknown }).likesCount ??
    (comment as CommentItem & { likesCount?: unknown; like_count?: unknown }).like_count;
  const count = Number(raw ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function isCommentLikedByViewer(comment: CommentItem): boolean {
  const raw =
    (comment as CommentItem & { likedByViewer?: unknown; liked_by_viewer?: unknown })
      .likedByViewer ??
    (comment as CommentItem & { likedByViewer?: unknown; liked_by_viewer?: unknown })
      .liked_by_viewer;
  return raw === true || raw === 1 || raw === "true";
}

function CommentText({
  onPressUser,
  text,
}: {
  onPressUser?: (username: string) => void;
  text: string;
}) {
  const parts = useMemo(() => text.split(/(@[a-zA-Z0-9_.]+)/g), [text]);

  return (
    <Text
      style={{
        marginTop: tokens.spacing.xs,
        fontSize: tokens.typography.body,
        lineHeight: tokens.lineHeight.body,
        color: tokens.colors.foreground,
      }}
    >
      {parts.map((part, index) =>
        part.startsWith("@") ? (
          <Text
            key={`${part}-${index}`}
            style={{ color: tokens.colors.primaryDark, fontWeight: tokens.fontWeight.extrabold }}
            onPress={() => onPressUser?.(part.slice(1))}
          >
            {part}
          </Text>
        ) : (
          <Text key={`${part}-${index}`}>{part}</Text>
        ),
      )}
    </Text>
  );
}

type Props = {
  comment: CommentItem;
  isReply: boolean;
  isOwner: boolean;
  canDelete: boolean;
  onPressUser?: (username: string) => void;
  onReply: (comment: CommentItem) => void;
  onDeleteComment?: (comment: CommentItem) => Promise<void> | void;
  onReportComment?: (comment: CommentItem) => Promise<void> | void;
  onToggleLike?: (comment: CommentItem) => Promise<void> | void;
  onOpenLikes?: (comment: CommentItem) => Promise<void> | void;
};

export function CommentPanelRow({
  canDelete,
  comment,
  isOwner,
  isReply,
  onDeleteComment,
  onOpenLikes,
  onPressUser,
  onReply,
  onReportComment,
  onToggleLike,
}: Props) {
  const likeCount = getCommentLikeCount(comment);
  const likedByViewer = isCommentLikedByViewer(comment);
  const avatarSize = isReply ? 32 : 40;
  const menuActions =
    canDelete && onDeleteComment
      ? [
          {
            destructive: true,
            key: "delete",
            label: "Yorumu sil",
            onPress: () => {
              void onDeleteComment(comment);
            },
          },
        ]
      : onReportComment
        ? [
            {
              key: "report",
              label: "Yorumu şikayet et",
              onPress: () => {
                void onReportComment(comment);
              },
            },
          ]
        : [];

  return (
    <View
      style={{
        flexDirection: "row",
        gap: tokens.spacing.sm,
      }}
    >
      <Pressable
        onPress={() => onPressUser?.(comment.username)}
        accessibilityRole="button"
        accessibilityLabel={`${formatName(comment)} profilini aç`}
        hitSlop={tokens.hitSlop.sm}
      >
        <Avatar
          uri={comment.image}
          variants={comment.imageVariants}
          name={formatName(comment)}
          size={avatarSize}
        />
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            borderRadius: isReply ? tokens.radius.lg : tokens.radius.xl,
            backgroundColor: isReply ? tokens.colors.surfaceTint : tokens.colors.surface,
            borderWidth: 1,
            borderColor: isReply ? tokens.colors.borderLight : tokens.colors.divider,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: tokens.spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}>
            <Pressable
              onPress={() => onPressUser?.(comment.username)}
              accessibilityRole="button"
              accessibilityLabel={`${formatName(comment)} profilini aç`}
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              <Text
                style={{
                  fontSize: isReply ? tokens.typography.body : 15,
                  fontWeight: tokens.fontWeight.extrabold,
                  color: tokens.colors.foreground,
                }}
                numberOfLines={1}
              >
                {formatName(comment)}
              </Text>
            </Pressable>
            {isOwner ? (
              <View
                style={{
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.primarySofter,
                  paddingHorizontal: tokens.spacing.xs,
                  paddingVertical: tokens.spacing.micro,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.primaryDark,
                    fontSize: tokens.typography.nano,
                    fontWeight: tokens.fontWeight.extrabold,
                  }}
                >
                  Sahibi
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={{
              marginTop: tokens.spacing.micro,
              fontSize: tokens.typography.caption,
              color: tokens.colors.mutedFg,
              fontWeight: tokens.fontWeight.semibold,
            }}
            numberOfLines={1}
          >
            {comment.time || formatAbsoluteDateTime(comment.createdAt) || "Tarih bilinmiyor"}
          </Text>

          <CommentText text={comment.text} onPressUser={onPressUser} />
        </View>

        <View
          style={{
            marginTop: tokens.spacing.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xs,
          }}
        >
          <Pressable
            onPress={() => onReply(comment)}
            accessibilityRole="button"
            accessibilityLabel={`${formatName(comment)} kullanıcısına yanıt ver`}
            hitSlop={tokens.hitSlop.sm}
            style={{
              minHeight: 30,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: tokens.spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <MessageCircle size={13} color={tokens.colors.mutedFg} />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.extrabold,
                color: tokens.colors.muted,
              }}
            >
              Yanıtla
            </Text>
          </Pressable>

          <Pressable
            disabled={!onToggleLike}
            accessibilityRole="button"
            accessibilityLabel={likedByViewer ? "Beğeniyi kaldır" : "Yorumu beğen"}
            accessibilityState={{ disabled: !onToggleLike, selected: likedByViewer }}
            onPress={() => {
              void onToggleLike?.(comment);
            }}
            onLongPress={() => {
              void onOpenLikes?.(comment);
            }}
            delayLongPress={500}
            hitSlop={tokens.hitSlop.sm}
            style={{
              minHeight: 30,
              borderRadius: tokens.radius.pill,
              backgroundColor: likedByViewer ? tokens.colors.dangerSoft : tokens.colors.surface,
              borderWidth: 1,
              borderColor: likedByViewer ? tokens.colors.dangerBorder : tokens.colors.border,
              paddingHorizontal: tokens.spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
            }}
          >
            <Heart
              size={14}
              color={likedByViewer ? tokens.colors.danger : tokens.colors.mutedFg}
              fill={likedByViewer ? tokens.colors.danger : "transparent"}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.extrabold,
                color: likedByViewer ? tokens.colors.danger : tokens.colors.muted,
              }}
            >
              {likeCount > 0 ? likeCount : "Beğen"}
            </Text>
          </Pressable>

          {menuActions.length ? (
            <OverflowActionMenu
              actions={menuActions}
              title="Yorum işlemleri"
              buttonSize={tokens.iconSize["3xl"]}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
