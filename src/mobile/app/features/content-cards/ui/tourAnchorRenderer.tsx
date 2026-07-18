import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type TourAnchorRenderProps = {
  children: ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tourId: string;
};

export type TourAnchorRenderer = (props: TourAnchorRenderProps) => ReactNode;

export function renderTourAnchor(
  renderer: TourAnchorRenderer | undefined,
  props: TourAnchorRenderProps,
) {
  if (renderer) {
    return renderer(props);
  }
  if (props.style) {
    return <View style={props.style}>{props.children}</View>;
  }
  return <>{props.children}</>;
}
