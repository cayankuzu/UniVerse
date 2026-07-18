import { ChevronRight, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import type {
  DetailAccessChip,
  DetailMetaChip,
  DetailSlideItem,
} from "../../application/eventDetailPresentation";

export function EventDetailInfoSlides({ slides }: { slides: DetailSlideItem[] }) {
  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, marginTop: tokens.spacing.sm, paddingRight: 10 }}
    >
      {slides.map((slide, index) => {
        const Icon = slide.icon;
        return (
          <View
            key={`detail-slide-${index}-${slide.sub}-${slide.label}`}
            style={{
              minWidth: 132,
              borderRadius: 11,
              backgroundColor: slide.backgroundColor,
              paddingHorizontal: 9,
              paddingVertical: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                backgroundColor: "rgba(255,255,255,0.74)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={13} color={slide.iconColor} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text
                style={{
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                  color: slide.textColor,
                  lineHeight: 15,
                }}
              >
                {slide.label}
              </Text>
              <Text
                style={{
                  fontSize: tokens.typography.nano,
                  color: tokens.colors.mutedFg,
                  marginTop: 1,
                  lineHeight: 13,
                }}
              >
                {slide.sub}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function EventDetailMetaChips({ chips }: { chips: DetailMetaChip[] }) {
  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 5, marginTop: 10, paddingRight: tokens.spacing.xs }}
    >
      {chips.map((chip, index) => (
        <View
          key={`detail-chip-${index}-${chip.kind}-${chip.label}`}
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor:
              chip.kind === "type" ? tokens.colors.warningSoft : tokens.colors.violetSoft,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: 3,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{
              fontSize: tokens.typography.micro,
              fontWeight: tokens.fontWeight.bold,
              color: chip.kind === "type" ? tokens.colors.orangeText : tokens.colors.violetDark,
              lineHeight: tokens.typography.caption,
            }}
          >
            {chip.label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function EventDetailAttendanceBar(props: {
  accessChip: DetailAccessChip;
  attendees: number;
  capacity: number;
  enabled: boolean;
  onPress: () => void;
}) {
  const progress = Math.min(100, Math.round((props.attendees / Math.max(props.capacity, 1)) * 100));
  const AccessIcon = props.accessChip.icon;

  return (
    <View style={{ marginTop: tokens.spacing.sm }}>
      <Pressable
        accessibilityLabel="Etkinlik katılımcılarını aç"
        disabled={!props.enabled}
        onPress={props.onPress}
        style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
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
          {props.attendees}/{props.capacity}
        </Text>
        <ChevronRight size={tokens.typography.caption} color={tokens.colors.borderLight} />
      </Pressable>

      <View
        style={{
          marginTop: 7,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          flexWrap: "wrap",
        }}
      >
        <View
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor: props.accessChip.backgroundColor,
            paddingHorizontal: 7,
            paddingVertical: 3,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs,
          }}
        >
          <AccessIcon size={tokens.typography.micro} color={props.accessChip.color} />
          <Text
            style={{
              fontSize: tokens.typography.micro,
              fontWeight: tokens.fontWeight.bold,
              color: props.accessChip.color,
            }}
          >
            {`Erişim: ${props.accessChip.label}`}
          </Text>
        </View>
      </View>
    </View>
  );
}
