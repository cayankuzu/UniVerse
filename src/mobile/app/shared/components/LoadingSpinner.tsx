import { View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { tokens } from "../../shared/theme";

interface Props {
  color?: string;
  size?: "small" | "large";
  fullScreen?: boolean;
}

export function LoadingSpinner({
  color = tokens.colors.primary,
  size = "large",
  fullScreen,
}: Props) {
  if (fullScreen) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={color} size={size} />
      </View>
    );
  }
  return <ActivityIndicator color={color} size={size} />;
}
