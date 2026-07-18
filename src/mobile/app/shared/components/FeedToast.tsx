import { AlertTriangle } from "lucide-react-native";
import { Text, View } from "react-native";
import { useFloatingBottomMargin } from "../layout/bottomNavSpacing";
import { tokens } from "../../shared/theme";

interface Props {
  message: string | null;
  bottomOffset?: number;
}

export function FeedToast({ message, bottomOffset }: Props) {
  const floatingBottom = useFloatingBottomMargin(tokens.spacing.md, 28);
  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: tokens.spacing.lg,
        right: tokens.spacing.lg,
        bottom: bottomOffset ?? floatingBottom,
        zIndex: 999,
        elevation: tokens.spacing.md,
        alignItems: "center",
      }}
    >
      <View
        style={{
          borderRadius: tokens.radius.md,
          backgroundColor: "rgba(15,23,42,0.95)",
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          maxWidth: 360,
          shadowColor: tokens.colors.shadow,
          shadowOffset: { width: 0, height: tokens.spacing.xs },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        }}
      >
        <AlertTriangle size={tokens.iconSize.md} color={tokens.colors.amber} />
        <Text
          style={{
            color: tokens.colors.surface,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.semibold,
            flexShrink: 1,
          }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}
