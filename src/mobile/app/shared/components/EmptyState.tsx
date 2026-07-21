import { View } from "react-native";
import { Surface } from "react-native-paper";
import { AppText as Text } from "./AppText";
import { tokens } from "../../shared/theme";

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <View
      accessibilityLabel={!action ? (subtitle ? `${title}. ${subtitle}` : title) : undefined}
      accessible={!action}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: tokens.spacing.xxl,
        paddingVertical: tokens.spacing["3xl"],
        gap: tokens.spacing.sm,
      }}
    >
      {icon && (
        <Surface
          elevation={0}
          style={{
            width: 56,
            height: 56,
            borderRadius: tokens.radius.xl,
            backgroundColor: tokens.colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: tokens.spacing.xxs,
          }}
        >
          {icon}
        </Surface>
      )}
      <Text
        style={{
          fontSize: tokens.typography.header,
          fontWeight: "700",
          color: tokens.colors.text,
          textAlign: "center",
          lineHeight: tokens.lineHeight.header,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: tokens.typography.body,
            color: tokens.colors.muted,
            textAlign: "center",
            lineHeight: tokens.lineHeight.body,
          }}
        >
          {subtitle}
        </Text>
      )}
      {action}
    </View>
  );
}
