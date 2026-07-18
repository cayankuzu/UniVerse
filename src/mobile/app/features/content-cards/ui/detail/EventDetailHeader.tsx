import { Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Avatar } from "../../../../shared/components";
import type { EventWithMeta } from "../../data";
import { tokens } from "../../../../shared/theme";

interface EventDetailHeaderProps {
  event: EventWithMeta;
  onPress?: () => void;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function EventDetailHeader({ event, onPress }: EventDetailHeaderProps) {
  const dateLabel = formatDate(event.createdAt);
  const timeLabel = formatTime(event.createdAt);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: tokens.spacing.sm,
        paddingBottom: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: tokens.radius.pill,
            overflow: "hidden",
            backgroundColor: tokens.colors.border,
            borderWidth: 2,
            borderColor: tokens.colors.blueSoft,
          }}
        >
          {event.clubImage ? (
            <Avatar uri={event.clubImage} name={event.club} size={40} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Users size={tokens.iconSize.lg} color={tokens.colors.muted} strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: tokens.fontWeight.bold,
              color: tokens.colors.foreground,
            }}
            numberOfLines={1}
          >
            {event.club}
          </Text>
          <Text
            style={{
              fontSize: tokens.typography.caption,
              color: tokens.colors.muted,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {event.university}
          </Text>
        </View>
      </Pressable>

      {dateLabel || timeLabel ? (
        <View style={{ alignItems: "flex-end", gap: 1, marginRight: 2 }}>
          {!!dateLabel && (
            <Text
              style={{
                fontSize: tokens.typography.micro,
                color: tokens.colors.mutedFg,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {dateLabel}
            </Text>
          )}
          {!!timeLabel && (
            <Text
              style={{
                fontSize: tokens.typography.micro,
                color: tokens.colors.mutedFg,
                fontWeight: tokens.fontWeight.semibold,
              }}
            >
              {timeLabel}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
