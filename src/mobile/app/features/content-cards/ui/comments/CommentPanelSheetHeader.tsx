import { MessageCircle, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { tokens } from "../../../../shared/theme";

interface CommentPanelSheetHeaderProps {
  title: string;
  commentCount: number;
  onClose: () => void;
}

export function CommentPanelSheetHeader({
  commentCount,
  onClose,
  title,
}: CommentPanelSheetHeaderProps) {
  const countLabel = commentCount === 1 ? "1 yorum" : `${commentCount} yorum`;

  return (
    <>
      <View
        style={{
          alignSelf: "center",
          width: 54,
          height: 5,
          borderRadius: 999,
          backgroundColor: tokens.colors.border,
          marginTop: 10,
        }}
      />

      <View
        style={{
          marginTop: 10,
          paddingHorizontal: tokens.spacing.md,
          paddingBottom: tokens.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.divider,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.sm,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.colors.primarySofter,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle size={18} color={tokens.colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.subtitle,
              fontWeight: tokens.fontWeight.extrabold,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: tokens.colors.mutedFg,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            {countLabel}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Yorum panelini kapat"
          accessibilityRole="button"
          hitSlop={tokens.hitSlop.sm}
          onPress={onClose}
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.colors.surfaceVariant,
          }}
        >
          <X size={20} color={tokens.colors.iconMuted} />
        </Pressable>
      </View>
    </>
  );
}
