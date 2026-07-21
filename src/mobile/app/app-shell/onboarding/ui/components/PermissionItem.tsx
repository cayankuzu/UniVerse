import { Pressable, View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { PermissionToggle } from "./PermissionToggle";
import { tokens, withAlpha } from "../../../../shared/theme";

interface PermissionItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  granted: boolean;
  statusLabel?: string;
  onToggle: () => void;
}

export function PermissionItem({
  icon,
  label,
  description,
  granted,
  statusLabel,
  onToggle,
}: PermissionItemProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: granted }}
      onPress={onToggle}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.smPlus,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.md,
          borderWidth: 1,
        },
        granted
          ? {
              backgroundColor: withAlpha(tokens.colors.primary, 0.15),
              borderColor: withAlpha(tokens.colors.blueMuted, 0.3),
            }
          : {
              backgroundColor: withAlpha(tokens.colors.onMedia, 0.05),
              borderColor: withAlpha(tokens.colors.onMedia, 0.1),
            },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: tokens.radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: granted
            ? withAlpha(tokens.colors.primary, 0.2)
            : withAlpha(tokens.colors.onMedia, 0.1),
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: tokens.typography.body,
            fontWeight: "600",
            color: granted ? tokens.colors.blueSubtle : withAlpha(tokens.colors.onMedia, 0.9),
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: tokens.typography.caption,
            color: withAlpha(tokens.colors.onMedia, 0.4),
            marginTop: tokens.spacing.micro,
          }}
        >
          {description}
        </Text>
        {statusLabel ? (
          <Text
            style={{
              fontSize: tokens.typography.caption,
              marginTop: tokens.spacing.xxs,
              color: granted ? tokens.colors.blueSubtle : withAlpha(tokens.colors.onMedia, 0.55),
              fontWeight: "600",
            }}
          >
            {statusLabel}
          </Text>
        ) : null}
      </View>

      <PermissionToggle value={granted} onToggle={onToggle} />
    </Pressable>
  );
}
