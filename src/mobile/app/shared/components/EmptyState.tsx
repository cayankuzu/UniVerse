import { View } from "react-native";
import { Surface, Text } from "react-native-paper";
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
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 48,
        gap: 12,
      }}
    >
      {icon && (
        <Surface
          elevation={0}
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: tokens.colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          {icon}
        </Surface>
      )}
      <Text
        style={{
          fontSize: 17,
          fontWeight: "700",
          color: tokens.colors.text,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            color: tokens.colors.muted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
      {action}
    </View>
  );
}
