import { ChevronRight, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import type { AccessChip } from "./EventCardBody.shared";
import { tokens } from "../../../../shared/theme";

interface EventCardAttendanceBarProps {
  accessChip: AccessChip;
  attendees: number;
  capacity: number;
  isTourTarget: boolean;
  onPressAttendees?: () => void;
  renderTourAnchor?: TourAnchorRenderer;
}

export function EventCardAttendanceBar({
  accessChip,
  attendees,
  capacity,
  isTourTarget,
  onPressAttendees,
  renderTourAnchor: anchorRenderer,
}: EventCardAttendanceBarProps) {
  const progress = Math.min(100, Math.round((attendees / Math.max(capacity, 1)) * 100));
  const AccessIcon = accessChip.icon;

  return renderTourAnchor(anchorRenderer, {
    enabled: isTourTarget,
    tourId: "attendee-location",
    children: (
      <View>
        <Pressable
          accessibilityLabel="Etkinlik katılımcılarını aç"
          onPress={onPressAttendees}
          disabled={!onPressAttendees}
          style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 }}
        >
          <Users size={13} color={tokens.colors.mutedFg} />
          <View
            style={{
              flex: 1,
              height: 7,
              borderRadius: tokens.spacing.xxs,
              backgroundColor: tokens.colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: tokens.spacing.xxs,
                backgroundColor: progress > 80 ? tokens.colors.orange : tokens.colors.primaryLight,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
              color: tokens.colors.dark600,
            }}
          >
            {attendees}/{capacity}
          </Text>
          <ChevronRight size={tokens.typography.caption} color={tokens.colors.borderLight} />
        </Pressable>

        <View style={{ marginTop: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <View
              style={{
                borderRadius: tokens.radius.pill,
                backgroundColor: accessChip.backgroundColor,
                paddingHorizontal: 7,
                paddingVertical: 3,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xxs,
                flexShrink: 0,
              }}
            >
              <AccessIcon size={tokens.typography.micro} color={accessChip.color} />
              <Text
                style={{
                  fontSize: tokens.typography.micro,
                  fontWeight: tokens.fontWeight.bold,
                  color: accessChip.color,
                }}
              >
                {`Erişim: ${accessChip.label}`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
  });
}
