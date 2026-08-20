import { Users } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { EventWithMeta } from "../../data";
import { formatContentAgeLabel } from "../../application/feedCardPresentation";
import type { HomeEventCardPresentation } from "./eventCard.types";
import { tokens } from "../../../../shared/theme";

interface Props {
  event: EventWithMeta;
  presentation?: HomeEventCardPresentation;
  onPress?: () => void;
}

export function EventCardHeader({ event, presentation, onPress }: Props) {
  const ageLabel = formatContentAgeLabel(event.createdAt);
  const clubSubtitle = presentation?.clubSubtitle || event.university;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${event.club || "Kulüp"} profilini aç`}
        style={styles.pressable}
      >
        <View style={styles.avatarFrame}>
          {event.clubImage ? (
            <Avatar
              uri={event.clubImage}
              name={event.club}
              size={34}
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

      {ageLabel ? (
        <View style={styles.timeCopy}>
          <Text style={styles.timeLabel}>{ageLabel}</Text>
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
    marginTop: tokens.spacing.hairline,
  },
  clubTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.typography.control,
    fontWeight: tokens.fontWeight.bold,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.compact,
    paddingBottom: tokens.spacing.compact,
    paddingHorizontal: tokens.spacing.smPlus,
    paddingTop: tokens.spacing.sm,
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.compact,
  },
  timeCopy: {
    alignItems: "flex-end",
    gap: tokens.spacing.hairline,
    marginRight: tokens.spacing.micro,
  },
  timeLabel: {
    color: tokens.colors.mutedFg,
    fontSize: tokens.typography.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
});
