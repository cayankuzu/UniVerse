import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "./AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, withAlpha } from "../../shared/theme";
import { InstantPressable } from "./InstantPressable";

interface Props {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  transparent?: boolean;
  horizontalPadding?: number;
  ownsTopInset?: boolean;
}

export function BackHeader({
  title,
  right,
  onBack,
  transparent,
  horizontalPadding = tokens.spacing.compact,
  ownsTopInset = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View
      style={{
        paddingTop: ownsTopInset ? insets.top : 0,
        paddingHorizontal: horizontalPadding,
        paddingBottom: tokens.spacing.xs,
        minHeight: tokens.minHeight.header + (ownsTopInset ? insets.top : 0),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: transparent ? "transparent" : tokens.colors.surface,
        borderBottomWidth: transparent ? 0 : 1,
        borderBottomColor: tokens.colors.border,
      }}
    >
      <InstantPressable
        accessibilityLabel="Geri git"
        accessibilityRole="button"
        haptic="selection"
        hitSlop={tokens.hitSlop.sm}
        onPress={
          onBack ??
          (() => {
            if ((navigation as { canGoBack?: () => boolean }).canGoBack?.()) {
              (navigation as { goBack: () => void }).goBack();
            }
          })
        }
        style={{
          width: tokens.minHeight.header,
          height: tokens.minHeight.header,
          borderRadius: tokens.radius.compact,
          backgroundColor: transparent
            ? withAlpha(tokens.colors.onMedia, 0.15)
            : tokens.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft
          size={tokens.iconSize.xl}
          color={transparent ? tokens.colors.surface : tokens.colors.foreground}
          strokeWidth={tokens.strokeWidth.emphasis}
        />
      </InstantPressable>

      {title && (
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: tokens.typography.control,
            lineHeight: tokens.lineHeight.control,
            fontWeight: tokens.fontWeight.bold,
            color: transparent ? tokens.colors.surface : tokens.colors.foreground,
            marginHorizontal: tokens.spacing.xs,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
      )}

      <View style={{ width: tokens.minHeight.header, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
