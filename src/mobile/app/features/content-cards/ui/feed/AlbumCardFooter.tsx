import { Calendar, Heart, MessageCircle } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import {
  InstantPressable,
  OverflowActionMenu,
  type OverflowActionItem,
} from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

type Props = {
  liked: boolean;
  likes: number;
  comments: number;
  hideEventAction?: boolean;
  onLike: () => void;
  onLikeLongPress?: () => void;
  onComment: () => void;
  onOpenEvent: () => void;
  eventLabel: string;
  eventDisabled?: boolean;
  menuActions?: OverflowActionItem[] | null;
};

export function AlbumCardFooter({
  liked,
  likes,
  comments,
  hideEventAction = false,
  onLike,
  onLikeLongPress,
  onComment,
  onOpenEvent,
  eventLabel,
  eventDisabled = false,
  menuActions,
}: Props) {
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
      <InstantPressable
        accessibilityLabel="Albüm beğenilerini aç"
        accessibilityRole="button"
        hitSlop={tokens.hitSlop.md}
        onPress={onLike}
        onLongPress={onLikeLongPress}
        delayLongPress={500}
        haptic="light"
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
      </InstantPressable>

      <InstantPressable
        accessibilityLabel="Albüm yorumlarını aç"
        accessibilityRole="button"
        hitSlop={tokens.hitSlop.md}
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
          {comments}
        </Text>
      </InstantPressable>

      <View style={{ flex: 1 }} />

      {!hideEventAction ? (
        <InstantPressable
          accessibilityLabel={eventLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: eventDisabled }}
          hitSlop={tokens.hitSlop.md}
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
          <Calendar
            size={13}
            color={eventDisabled ? tokens.colors.mutedFg : tokens.colors.primary}
          />
          <Text
            style={{
              fontSize: tokens.typography.tiny,
              fontWeight: tokens.fontWeight.bold,
              color: eventDisabled ? tokens.colors.mutedFg : tokens.colors.primary,
            }}
          >
            {eventLabel}
          </Text>
        </InstantPressable>
      ) : null}

      <OverflowActionMenu actions={menuActions || []} title="Albüm İşlemleri" buttonSize={32} />
    </View>
  );
}
