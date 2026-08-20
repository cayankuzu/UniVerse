import { ExpandableCardText } from "../shared/ExpandableCardText";
import { tokens } from "../../../../shared/theme";

interface EventDetailDescriptionProps {
  description: string;
}

export function EventDetailDescription({ description }: EventDetailDescriptionProps) {
  return (
    <ExpandableCardText
      containerStyle={{ marginTop: tokens.spacing.xsMinus }}
      text={description}
      textStyle={{
        color: tokens.colors.muted,
        fontSize: tokens.typography.label,
        lineHeight: tokens.lineHeight.bodyCompact,
      }}
      toggleTextStyle={{
        color: tokens.colors.primary,
        fontSize: tokens.typography.caption,
        fontWeight: "700",
      }}
    />
  );
}
