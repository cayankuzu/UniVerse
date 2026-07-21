import React from "react";
import { View } from "react-native";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import { tokens, withAlpha } from "../../../../shared/theme";

const EVENT_CARD_CONTAINER_STYLE = {
  borderRadius: tokens.radius.xl,
  overflow: "hidden" as const,
  backgroundColor: tokens.colors.onMedia,
  borderWidth: 1,
  borderColor: withAlpha(tokens.colors.foreground, 0.06),
  marginBottom: tokens.spacing.sm,
  shadowColor: tokens.colors.foreground,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 3,
};

type EventAccessWarningReason = {
  albumReason?: string | null;
  reason?: string | null;
};

export const TEMP_EVENT_WARNING = "Etkinlik henüz kaydediliyor. Birazdan tekrar deneyin.";

export function getAlbumWarningMessage(reason: EventAccessWarningReason) {
  return reason.albumReason || reason.reason || "Bu albüm sadece yetkili kullanıcılara açık.";
}

export function getLocationWarningMessage(reason: EventAccessWarningReason) {
  return (
    reason.albumReason || reason.reason || "Konum bilgisi bu etkinlik için sadece takipçilere açık."
  );
}

export function EventCardSurface(props: {
  children: React.ReactNode;
  isTourTarget: boolean;
  renderTourAnchor?: TourAnchorRenderer;
}) {
  return renderTourAnchor(props.renderTourAnchor, {
    children: <View style={EVENT_CARD_CONTAINER_STYLE}>{props.children}</View>,
    enabled: props.isTourTarget,
    tourId: "event-card",
  });
}
