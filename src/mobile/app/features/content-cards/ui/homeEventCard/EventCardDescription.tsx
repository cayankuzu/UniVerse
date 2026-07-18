import { ExpandableCardText } from "../shared/ExpandableCardText";

interface EventCardDescriptionProps {
  description: string;
}

export function EventCardDescription({ description }: EventCardDescriptionProps) {
  return (
    <ExpandableCardText
      containerStyle={{ marginTop: 5 }}
      text={description}
      textStyle={{ color: "#64748b", fontSize: 13, lineHeight: 19 }}
      toggleTextStyle={{ color: "#2563eb", fontSize: 12, fontWeight: "700" }}
    />
  );
}
