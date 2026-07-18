import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { EventWithMeta } from "../../data";
import { EventCardAttendanceBar } from "./EventCardAttendanceBar";
import {
  buildEventInfoSlides,
  buildEventMetaChips,
  resolveEventAccessChip,
} from "./EventCardBody.shared";
import { EventCardDescription } from "./EventCardDescription";
import { EventCardInfoSlides } from "./EventCardInfoSlides";
import { EventCardMetaChips } from "./EventCardMetaChips";
import type { TourAnchorRenderer } from "../tourAnchorRenderer";
import {
  resolvePreparedEventAccessChipDisplay,
  resolvePreparedEventInfoSlideDisplay,
} from "../../application/feedCardPresentation";
import type { HomeEventCardPresentation } from "./eventCard.types";

interface Props {
  event: EventWithMeta;
  presentation?: HomeEventCardPresentation;
  attendees: number;
  isTourTarget?: boolean;
  onPressAttendees?: () => void;
  renderTourAnchor?: TourAnchorRenderer;
}

export function EventCardBody({
  event,
  presentation,
  attendees,
  isTourTarget = false,
  onPressAttendees,
  renderTourAnchor,
}: Props) {
  const capacity = Math.max(event.capacity || 1, 1);
  const dateLabel = event.startDate || event.date || "-";
  const timeLabel =
    event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "-";
  const accessChip = useMemo(
    () =>
      presentation?.accessChip
        ? resolvePreparedEventAccessChipDisplay(presentation.accessChip)
        : resolveEventAccessChip(event),
    [event, presentation?.accessChip],
  );
  const chips = useMemo(
    () => presentation?.metaChips || buildEventMetaChips(event),
    [event, presentation?.metaChips],
  );
  const infoSlides = useMemo(
    () =>
      presentation?.infoSlides
        ? presentation.infoSlides.map(resolvePreparedEventInfoSlideDisplay)
        : buildEventInfoSlides(event, dateLabel, timeLabel),
    [dateLabel, event, presentation?.infoSlides, timeLabel],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      <EventCardDescription description={event.description || ""} />
      <EventCardInfoSlides
        isTourTarget={isTourTarget}
        renderTourAnchor={renderTourAnchor}
        slides={infoSlides}
      />
      <EventCardMetaChips chips={chips} />
      <EventCardAttendanceBar
        accessChip={accessChip}
        attendees={attendees}
        capacity={capacity}
        isTourTarget={isTourTarget}
        onPressAttendees={onPressAttendees}
        renderTourAnchor={renderTourAnchor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  title: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
});
