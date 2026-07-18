import { Pressable, Text, View } from "react-native";
import { PermissionToggle } from "./PermissionToggle";

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
          gap: 14,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
        },
        granted
          ? {
              backgroundColor: "rgba(37,99,235,0.15)",
              borderColor: "rgba(96,165,250,0.3)",
            }
          : {
              backgroundColor: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.1)",
            },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: granted ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.1)",
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: granted ? "#93c5fd" : "rgba(255,255,255,0.9)",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            marginTop: 2,
          }}
        >
          {description}
        </Text>
        {statusLabel ? (
          <Text
            style={{
              fontSize: 11,
              marginTop: 4,
              color: granted ? "#93c5fd" : "rgba(255,255,255,0.55)",
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
