import { ExpandableCardText } from "../shared/ExpandableCardText";

interface EventDetailDescriptionProps {
  description: string;
}

export function EventDetailDescription({ description }: EventDetailDescriptionProps) {
  return (
    <ExpandableCardText
      containerStyle={{ marginTop: 5 }}
      text={description}
      textStyle={{ color: "#64748b", fontSize: 13, lineHeight: 19 }}
      toggleTextStyle={{ color: "#2563eb", fontSize: 12, fontWeight: "700" }}
    />
  );
}
