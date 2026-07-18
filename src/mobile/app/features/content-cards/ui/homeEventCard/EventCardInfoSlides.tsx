import { Text, View } from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import type { SlideItem } from "./EventCardBody.shared";

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
        contentContainerStyle={{ gap: 7, marginTop: 10, paddingRight: 10 }}
      >
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <View
              key={`info-${index}-${slide.sub}-${slide.label}`}
              style={{
                minWidth: 132,
                borderRadius: 11,
                backgroundColor: slide.backgroundColor,
                paddingHorizontal: 9,
                paddingVertical: 8,
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
              <View style={{ flexShrink: 0 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: slide.textColor,
                    lineHeight: 15,
                  }}
                >
                  {slide.label}
                </Text>
                <Text style={{ fontSize: 9, color: "#94a3b8", marginTop: 1, lineHeight: 13 }}>
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
