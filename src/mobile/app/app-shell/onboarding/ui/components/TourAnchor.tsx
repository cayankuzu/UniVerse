import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

interface TourAnchorProps {
  children: ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tourId: string;
}

export function TourAnchor({ children, enabled = true, style, tourId: _tourId }: TourAnchorProps) {
  if (!enabled) {
    if (style) {
      return <View style={style}>{children}</View>;
    }
    return <>{children}</>;
  }

  return <View style={style}>{children}</View>;
}
