import { Users } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { EventWithMeta } from "../../data";
import {
  formatEventHeaderDate,
  formatEventHeaderTime,
} from "../../application/feedCardPresentation";
import type { HomeEventCardPresentation } from "./eventCard.types";
import { tokens } from "../../../../shared/theme";

interface Props {
  event: EventWithMeta;
  presentation?: HomeEventCardPresentation;
  onPress?: () => void;
}

export function EventCardHeader({ event, presentation, onPress }: Props) {
  const dateLabel = presentation?.createdAtDateLabel || formatEventHeaderDate(event.createdAt);
  const timeLabel = presentation?.createdAtTimeLabel || formatEventHeaderTime(event.createdAt);
  const clubSubtitle = presentation?.clubSubtitle || event.university;

  return (
    <View style={styles.container}>
      <Pressable onPress={onPress} style={styles.pressable}>
        <View style={styles.avatarFrame}>
          {event.clubImage ? (
            <Avatar
              uri={event.clubImage}
              name={event.club}
              size={40}
              fallbackInitials={presentation?.avatarInitials}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Users size={tokens.iconSize.lg} color={tokens.colors.muted} strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={styles.clubCopy}>
          <Text style={styles.clubTitle} numberOfLines={1}>
            {event.club}
          </Text>
          <Text style={styles.clubSubtitle} numberOfLines={1}>
            {clubSubtitle}
          </Text>
        </View>
      </Pressable>

      {dateLabel || timeLabel ? (
        <View style={styles.timeCopy}>
          {!!dateLabel && <Text style={styles.timeLabel}>{dateLabel}</Text>}
          {!!timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  avatarFrame: {
    backgroundColor: tokens.colors.border,
    borderColor: tokens.colors.blueSoft,
    borderRadius: tokens.radius.pill,
    borderWidth: 2,
    height: 40,
    overflow: "hidden",
    width: 40,
  },
  clubCopy: {
    flex: 1,
  },
  clubSubtitle: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.caption,
    marginTop: 1,
  },
  clubTitle: {
    color: tokens.colors.foreground,
    fontSize: 15,
    fontWeight: tokens.fontWeight.bold,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: tokens.spacing.sm,
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  timeCopy: {
    alignItems: "flex-end",
    gap: 1,
    marginRight: 2,
  },
  timeLabel: {
    color: tokens.colors.mutedFg,
    fontSize: tokens.typography.micro,
    fontWeight: tokens.fontWeight.semibold,
  },
});
