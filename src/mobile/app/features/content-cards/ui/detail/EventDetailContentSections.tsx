import { ChevronRight, Users } from "lucide-react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
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
      contentContainerStyle={{
        gap: tokens.spacing.xs,
        marginTop: tokens.spacing.sm,
        paddingRight: tokens.spacing.compact,
      }}
    >
      {slides.map((slide, index) => {
        const Icon = slide.icon;
        return (
          <View
            key={`detail-slide-${index}-${slide.sub}-${slide.label}`}
            style={{
              minWidth: 108,
              borderRadius: 11,
              backgroundColor: slide.backgroundColor,
              paddingHorizontal: tokens.spacing.xsPlus,
              paddingVertical: tokens.spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xs,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                backgroundColor: withAlpha(tokens.colors.onMedia, 0.74),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={13} color={slide.iconColor} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text
                style={{
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.bold,
                  color: slide.textColor,
                  lineHeight: tokens.lineHeight.caption,
                }}
              >
                {slide.label}
              </Text>
              <Text
                style={{
                  fontSize: tokens.typography.caption,
                  color: tokens.colors.mutedFg,
                  marginTop: tokens.spacing.hairline,
                  lineHeight: tokens.lineHeight.caption,
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
      contentContainerStyle={{
        gap: tokens.spacing.xsMinus,
        marginTop: tokens.spacing.compact,
        paddingRight: tokens.spacing.xs,
      }}
    >
      {chips.map((chip, index) => (
        <View
          key={`detail-chip-${index}-${chip.kind}-${chip.label}`}
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor:
              chip.kind === "type" ? tokens.colors.warningSoft : tokens.colors.violetSoft,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.microPlus,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{
              fontSize: tokens.typography.caption,
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
        accessibilityRole="button"
        accessibilityState={{ disabled: !props.enabled }}
        disabled={!props.enabled}
        hitSlop={tokens.hitSlop.md}
        onPress={props.onPress}
        style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}
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
          marginTop: tokens.spacing.xs,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xsMinus,
          flexWrap: "wrap",
        }}
      >
        <View
          style={{
            borderRadius: tokens.radius.pill,
            backgroundColor: props.accessChip.backgroundColor,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.microPlus,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs,
          }}
        >
          <AccessIcon size={tokens.typography.caption} color={props.accessChip.color} />
          <Text
            style={{
              fontSize: tokens.typography.caption,
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
