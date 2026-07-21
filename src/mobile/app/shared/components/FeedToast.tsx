import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "./AppText";
import { useFloatingBottomMargin } from "../layout/bottomNavSpacing";
import { tokens, withAlpha } from "../../shared/theme";
import { InstantPressable } from "./InstantPressable";

export type FeedToastTone = "error" | "info" | "success" | "warning";

interface Props {
  message: string | null;
  bottomOffset?: number;
  actionLabel?: string;
  onAction?: () => void;
  tone?: FeedToastTone;
}

function resolveTone(tone: FeedToastTone) {
  if (tone === "error") return { color: tokens.colors.dangerSurface, icon: AlertCircle };
  if (tone === "success") return { color: tokens.colors.successBorder, icon: CheckCircle2 };
  if (tone === "info") return { color: tokens.colors.blueSubtle, icon: Info };
  return { color: tokens.colors.amber, icon: AlertTriangle };
}

export function FeedToast({
  actionLabel,
  bottomOffset,
  message,
  onAction,
  tone = "warning",
}: Props) {
  const floatingBottom = useFloatingBottomMargin(tokens.spacing.md, 28);
  if (!message) return null;
  const toneConfig = resolveTone(tone);
  const Icon = toneConfig.icon;

  return (
    <View
      pointerEvents={onAction ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: tokens.spacing.lg,
        right: tokens.spacing.lg,
        bottom: bottomOffset ?? floatingBottom,
        zIndex: 999,
        elevation: tokens.shadow.md.elevation,
        alignItems: "center",
      }}
    >
      <View
        accessibilityLabel={!onAction ? message : undefined}
        accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
        accessibilityRole={tone === "error" ? "alert" : "text"}
        accessible={!onAction}
        style={{
          borderRadius: tokens.radius.md,
          backgroundColor: withAlpha(tokens.colors.foreground, 0.95),
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: tokens.spacing.compact,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          maxWidth: 360,
          shadowColor: tokens.colors.shadow,
          shadowOffset: tokens.shadow.md.shadowOffset,
          shadowOpacity: 0.22,
          shadowRadius: 18,
        }}
      >
        <Icon size={tokens.iconSize.md} color={toneConfig.color} />
        <Text
          style={{
            color: tokens.colors.surface,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.semibold,
            flexShrink: 1,
            lineHeight: tokens.lineHeight.caption,
          }}
        >
          {message}
        </Text>
        {actionLabel && onAction ? (
          <InstantPressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            haptic="selection"
            onPress={onAction}
            style={{
              borderRadius: tokens.radius.sm,
              minHeight: tokens.minHeight.buttonSm,
              justifyContent: "center",
              paddingHorizontal: tokens.spacing.xs,
            }}
          >
            <Text
              style={{
                color: toneConfig.color,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.extrabold,
              }}
            >
              {actionLabel}
            </Text>
          </InstantPressable>
        ) : null}
      </View>
    </View>
  );
}
