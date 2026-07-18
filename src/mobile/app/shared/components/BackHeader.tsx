import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../shared/theme";

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
  horizontalPadding = 10,
  ownsTopInset = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View
      style={{
        paddingTop: ownsTopInset ? insets.top : 0,
        paddingHorizontal: horizontalPadding,
        paddingBottom: 10,
        minHeight: tokens.minHeight.touchTarget + (ownsTopInset ? insets.top : 0) + 10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: transparent ? "transparent" : tokens.colors.surface,
        borderBottomWidth: transparent ? 0 : 1,
        borderBottomColor: tokens.colors.border,
      }}
    >
      <TouchableOpacity
        accessibilityLabel="Geri git"
        accessibilityRole="button"
        onPress={
          onBack ??
          (() => {
            if ((navigation as { canGoBack?: () => boolean }).canGoBack?.()) {
              (navigation as { goBack: () => void }).goBack();
            }
          })
        }
        style={{
          width: tokens.minHeight.touchTarget,
          height: tokens.minHeight.touchTarget,
          borderRadius: 10,
          backgroundColor: transparent ? "rgba(255,255,255,0.15)" : tokens.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft
          size={20}
          color={transparent ? tokens.colors.surface : tokens.colors.foreground}
          strokeWidth={2.5}
        />
      </TouchableOpacity>

      {title && (
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 15,
            lineHeight: 20,
            fontWeight: "700",
            color: transparent ? tokens.colors.surface : tokens.colors.foreground,
            marginHorizontal: 8,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
      )}

      <View style={{ width: tokens.minHeight.touchTarget, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
