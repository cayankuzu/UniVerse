import { Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";

interface PermissionToggleProps {
  value: boolean;
  onToggle: () => void;
}

export function PermissionToggle({ value, onToggle }: PermissionToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onToggle}
      style={{
        alignItems: "center",
        justifyContent: "center",
        minHeight: tokens.minHeight.touchTarget,
        minWidth: tokens.minHeight.touchTarget,
      }}
    >
      <View
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          backgroundColor: value ? "#2563eb" : "rgba(255,255,255,0.15)",
          justifyContent: "center",
          paddingHorizontal: 2,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#ffffff",
            alignSelf: value ? "flex-end" : "flex-start",
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </View>
    </Pressable>
  );
}
