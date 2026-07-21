import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import type { SlideItem } from "./EventCardBody.shared";
import { tokens, withAlpha } from "../../../../shared/theme";

interface EventCardInfoSlidesProps {
  isTourTarget: boolean;
  renderTourAnchor?: TourAnchorRenderer;
  slides: SlideItem[];
}

export function EventCardInfoSlides({
  isTourTarget,
  renderTourAnchor: anchorRenderer,
  slides,
}: EventCardInfoSlidesProps) {
  return renderTourAnchor(anchorRenderer, {
    enabled: isTourTarget,
    tourId: "info-slides",
    children: (
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: tokens.spacing.xsCompact,
          marginTop: tokens.spacing.compact,
          paddingRight: tokens.spacing.compact,
        }}
      >
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <View
              key={`info-${index}-${slide.sub}-${slide.label}`}
              style={{
                minWidth: 118,
                borderRadius: tokens.radius.md,
                backgroundColor: slide.backgroundColor,
                paddingHorizontal: tokens.spacing.xsPlus,
                paddingVertical: tokens.spacing.xs,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xsCompact,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: tokens.radius.compact,
                  backgroundColor: withAlpha(tokens.colors.onMedia, 0.74),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={tokens.iconSize.sm} color={slide.iconColor} />
              </View>
              <View style={{ flexShrink: 0 }}>
                <Text
                  style={{
                    fontSize: tokens.typography.label,
                    fontWeight: "700",
                    color: slide.textColor,
                    lineHeight: tokens.lineHeight.label,
                  }}
                >
                  {slide.label}
                </Text>
                <Text
                  style={{
                    fontSize: tokens.typography.caption,
                    color: tokens.colors.textSecondary,
                    marginTop: tokens.spacing.hairline,
                    lineHeight: tokens.lineHeight.compact,
                  }}
                >
                  {slide.sub}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    ),
  });
}
