import { View } from "react-native";
import { tokens, withAlpha } from "../../../../shared/theme";

interface PermissionToggleProps {
  value: boolean;
}

export function PermissionToggle({ value }: PermissionToggleProps) {
  return (
    <View
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
          borderRadius: tokens.radius.md,
          backgroundColor: value ? tokens.colors.primary : withAlpha(tokens.colors.onMedia, 0.15),
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.micro,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: tokens.radius.compact,
            backgroundColor: tokens.colors.onMedia,
            alignSelf: value ? "flex-end" : "flex-start",
            shadowColor: tokens.colors.mediaBlack,
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </View>
    </View>
  );
}
