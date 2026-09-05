import { CornerDownRight, Send, X } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import type { RefObject } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppScrollView as ScrollView, Avatar } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import { useLiveRegionAnnouncement } from "../../../../shared/hooks/useLiveRegionAnnouncement";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import type { CommentItem } from "../../data";

const QUICK_REACTIONS = [
  "\u2764\uFE0F",
  "\uD83D\uDC4D",
  "\uD83D\uDD25",
  "\uD83D\uDC4F",
  "\uD83D\uDE4F",
  "\uD83D\uDE0D",
];

type CurrentUser = {
  id?: string;
  username: string;
  name: string;
  image?: string;
  university?: string;
};

type Props = {
  currentUser: CurrentUser;
  replyTo: CommentItem | null;
  inputRef: RefObject<TextInput | null>;
  text: string;
  inputFocused: boolean;
  canSend: boolean;
  submitError: string;
  bottomPadding: number;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClearReply: () => void;
  onQuickReaction: (reaction: string) => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
};

export function CommentPanelComposer({
  bottomPadding,
  canSend,
  currentUser,
  inputFocused,
  inputRef,
  onBlur,
  onChangeText,
  onClearReply,
  onFocus,
  onQuickReaction,
  onSubmit,
  replyTo,
  submitError,
  text,
}: Props) {
  const remaining = TEXT_LIMITS.comment.body - text.length;
  // A failed send only shows this line; VoiceOver needs it spoken.
  useLiveRegionAnnouncement(submitError);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: tokens.colors.divider,
        backgroundColor: tokens.colors.surface,
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.xs,
        paddingBottom: Math.max(bottomPadding, tokens.spacing.xs),
        gap: tokens.spacing.xs,
        ...tokens.shadow.sm,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: tokens.spacing.xs,
          paddingHorizontal: tokens.spacing.hairline,
          paddingVertical: tokens.spacing.micro,
        }}
      >
        {QUICK_REACTIONS.map((reaction) => (
          <Pressable
            accessibilityLabel={`Hızlı tepki: ${reaction}`}
            accessibilityRole="button"
            hitSlop={tokens.hitSlop.sm}
            key={reaction}
            onPress={() => void onQuickReaction(reaction)}
            style={{
              width: 38,
              height: 34,
              borderRadius: tokens.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.colors.surfaceVariant,
              borderWidth: 1,
              borderColor: tokens.colors.border,
            }}
          >
            <Text style={{ fontSize: tokens.typography.sectionTitle }}>{reaction}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {replyTo ? (
        <View
          style={{
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.primarySofter,
            borderWidth: 1,
            borderColor: tokens.colors.primaryBorder,
            paddingLeft: tokens.spacing.sm,
            paddingRight: tokens.spacing.xsMinus,
            paddingVertical: tokens.spacing.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xs,
          }}
        >
          <CornerDownRight size={15} color={tokens.colors.primaryDark} />
          <Text
            style={{
              flex: 1,
              color: tokens.colors.primaryDeep,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.extrabold,
            }}
            numberOfLines={1}
          >
            @{replyTo.username} kullanıcısına yanıt
          </Text>
          <Pressable
            accessibilityLabel="Yanıt hedefini temizle"
            accessibilityRole="button"
            onPress={onClearReply}
            hitSlop={tokens.hitSlop.sm}
            style={{
              width: 28,
              height: 28,
              borderRadius: tokens.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.colors.surface,
            }}
          >
            <X size={15} color={tokens.colors.mutedFg} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={{
          borderRadius: 26,
          borderWidth: 1.5,
          borderColor: inputFocused ? tokens.colors.primaryBorder : tokens.colors.border,
          backgroundColor: inputFocused ? tokens.colors.surfaceTint : tokens.colors.surface,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: tokens.spacing.xs,
          paddingRight: tokens.spacing.xsMinus,
          minHeight: 44,
          gap: tokens.spacing.xs,
        }}
      >
        <Avatar
          uri={currentUser.image || ""}
          name={currentUser.name || currentUser.username}
          size={28}
        />

        <TextInput
          accessibilityLabel="Yorum yaz"
          ref={inputRef}
          value={text}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={replyTo ? `@${replyTo.username} yanıt yaz...` : "Konuşmaya katıl..."}
          placeholderTextColor={tokens.colors.mutedFg}
          multiline
          maxLength={TEXT_LIMITS.comment.body}
          style={{
            flex: 1,
            maxHeight: 88,
            color: tokens.colors.foreground,
            fontFamily: tokens.fontFamily.regular,
            fontSize: tokens.typography.body,
            lineHeight: tokens.lineHeight.body,
            paddingTop: tokens.spacing.sm,
            paddingBottom: tokens.spacing.sm,
          }}
        />

        <Pressable
          accessibilityLabel="Yorumu gönder"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          hitSlop={tokens.hitSlop.sm}
          onPress={() => void onSubmit()}
          disabled={!canSend}
          style={{
            width: 42,
            height: 42,
            borderRadius: tokens.radius.pill,
            backgroundColor: canSend ? tokens.colors.primary : tokens.colors.primaryBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send size={16} color={tokens.colors.surface} strokeWidth={2.1} />
        </Pressable>
      </View>

      <View
        style={{
          minHeight: 16,
          paddingHorizontal: tokens.spacing.xs,
          flexDirection: "row",
          gap: tokens.spacing.xs,
          justifyContent: "space-between",
        }}
      >
        <Text
          accessibilityLiveRegion={submitError ? "polite" : undefined}
          numberOfLines={2}
          style={{
            color: tokens.colors.danger,
            flex: 1,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          {submitError}
        </Text>
        <Text
          style={{
            color: remaining <= 0 ? tokens.colors.dangerDark : tokens.colors.mutedFg,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          {text.length}/{TEXT_LIMITS.comment.body}
        </Text>
      </View>
    </View>
  );
}
