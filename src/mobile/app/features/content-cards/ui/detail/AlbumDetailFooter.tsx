import { Calendar, Heart, MessageCircle } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { OverflowActionMenu, type OverflowActionItem } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

interface AlbumDetailFooterProps {
  commentCount: number;
  eventDisabled?: boolean;
  eventLabel: string;
  liked: boolean;
  likes: number;
  onComment: () => void;
  onLike: () => void;
  onLikeLongPress?: () => void;
  onOpenEvent: () => void;
  menuActions?: OverflowActionItem[] | null;
}

export function AlbumDetailFooter({
  commentCount,
  eventDisabled = false,
  eventLabel,
  liked,
  likes,
  onComment,
  onLike,
  onLikeLongPress,
  onOpenEvent,
  menuActions,
}: AlbumDetailFooterProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.xxs,
        paddingHorizontal: tokens.spacing.smPlus,
        paddingBottom: tokens.spacing.sm,
        paddingTop: tokens.spacing.compact,
        borderTopWidth: 1,
        borderTopColor: tokens.colors.divider,
        marginTop: tokens.spacing.xs,
      }}
    >
      <Pressable
        accessibilityLabel="Albüm beğenilerini aç"
        accessibilityRole="button"
        onPress={onLike}
        onLongPress={onLikeLongPress}
        delayLongPress={500}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xsMinus,
          borderRadius: tokens.radius.pill,
          paddingHorizontal: tokens.spacing.compact,
          minHeight: tokens.minHeight.buttonMd,
          backgroundColor: liked ? withAlpha(tokens.colors.dangerSurface, 0.9) : "transparent",
        }}
      >
        <Heart
          size={tokens.iconSize.lg}
          color={liked ? tokens.colors.danger : tokens.colors.mutedFg}
          fill={liked ? tokens.colors.danger : "transparent"}
          strokeWidth={1.7}
        />
        <Text
          style={{
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
            color: liked ? tokens.colors.danger : tokens.colors.muted,
          }}
        >
          {likes}
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Albüm yorumlarını aç"
        accessibilityRole="button"
        onPress={onComment}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xsMinus,
          borderRadius: tokens.radius.pill,
          paddingHorizontal: tokens.spacing.compact,
          minHeight: tokens.minHeight.buttonMd,
        }}
      >
        <MessageCircle size={tokens.iconSize.lg} color={tokens.colors.mutedFg} strokeWidth={1.7} />
        <Text
          style={{
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
            color: tokens.colors.muted,
          }}
        >
          {commentCount}
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityLabel={eventLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: eventDisabled }}
        onPress={onOpenEvent}
        style={{
          minHeight: tokens.minHeight.header,
          borderRadius: tokens.radius.pill,
          paddingHorizontal: tokens.spacing.smPlus,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: tokens.spacing.xsMinus,
          backgroundColor: eventDisabled ? tokens.colors.background : tokens.colors.accent,
          borderWidth: 1,
          borderColor: eventDisabled ? tokens.colors.border : tokens.colors.primaryBorder,
          opacity: eventDisabled ? 0.72 : 1,
        }}
      >
        <Calendar size={13} color={eventDisabled ? tokens.colors.mutedFg : tokens.colors.primary} />
        <Text
          style={{
            fontSize: tokens.typography.tiny,
            fontWeight: tokens.fontWeight.bold,
            color: eventDisabled ? tokens.colors.mutedFg : tokens.colors.primary,
          }}
        >
          {eventLabel}
        </Text>
      </Pressable>

      <OverflowActionMenu actions={menuActions || []} title="Albüm İşlemleri" buttonSize={32} />
    </View>
  );
}
