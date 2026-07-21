import { View } from "react-native";
import { AppText as Text } from "./AppText";
import { tokens } from "../theme";

interface Props {
  label: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "muted";
}

const STYLES = {
  default: { bg: tokens.colors.surfaceVariant, text: tokens.colors.dark600 },
  primary: { bg: tokens.colors.primarySofter, text: tokens.colors.primary },
  success: { bg: tokens.colors.successSurface, text: tokens.colors.successText },
  warning: { bg: tokens.colors.warningSoft, text: tokens.colors.warningIcon },
  danger: { bg: tokens.colors.dangerSoft, text: tokens.colors.dangerDark },
  muted: { bg: tokens.colors.background, text: tokens.colors.mutedFg },
};

export function Badge({ label, variant = "default" }: Props) {
  const s = STYLES[variant];
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      accessible
      style={{
        borderRadius: tokens.radius.pill,
        paddingHorizontal: tokens.spacing.compact,
        paddingVertical: tokens.spacing.microPlus,
        backgroundColor: s.bg,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: tokens.typography.tiny,
          fontWeight: tokens.fontWeight.semibold,
          color: s.text,
          fontVariant: ["tabular-nums"],
          lineHeight: tokens.lineHeight.tiny,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
