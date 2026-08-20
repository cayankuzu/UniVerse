import { ChevronRight, Users } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
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
  const remainingCapacity = Math.max(0, capacity - attendees);
  const capacityLabel =
    remainingCapacity === 0
      ? "Kontenjan doldu"
      : remainingCapacity <= Math.max(5, Math.round(capacity * 0.2))
        ? `${remainingCapacity} yer kaldı`
        : `${attendees}/${capacity}`;
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xs,
            marginTop: tokens.spacing.compact,
          }}
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
                backgroundColor: progress > 80 ? tokens.colors.warning : tokens.colors.primary,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.bold,
              color: progress > 80 ? tokens.colors.warningText : tokens.colors.textSecondary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {capacityLabel}
          </Text>
          <ChevronRight size={tokens.typography.caption} color={tokens.colors.borderLight} />
        </Pressable>

        <View style={{ marginTop: tokens.spacing.xs }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                borderRadius: tokens.radius.pill,
                backgroundColor: accessChip.backgroundColor,
                paddingHorizontal: tokens.spacing.xs,
                paddingVertical: tokens.spacing.microPlus,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xxs,
                flexShrink: 0,
              }}
            >
              <AccessIcon size={tokens.iconSize.xs} color={accessChip.color} />
              <Text
                style={{
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.bold,
                  color: accessChip.color,
                }}
              >
                {accessChip.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
  });
}
