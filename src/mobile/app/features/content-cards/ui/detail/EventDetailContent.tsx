import { LinearGradient } from "expo-linear-gradient";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Heart, Images, MapPin, MessageCircle } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { OverflowActionMenu, type OverflowActionItem } from "../../../../shared/components";
import type {
  DetailAccessChip,
  DetailMetaChip,
  DetailSlideItem,
} from "../../application/eventDetailPresentation";
import { tokens, withAlpha } from "../../../../shared/theme";
import {
  EventDetailAttendanceBar,
  EventDetailInfoSlides,
  EventDetailMetaChips,
} from "./EventDetailContentSections";

interface EventDetailContentProps {
  accessChip: DetailAccessChip;
  albumCount: number;
  albumDisabled: boolean;
  albumWarningMessage: string;
  attendees: number;
  bodyActionsEnabled: boolean;
  capacity: number;
  chips: DetailMetaChip[];
  commentCount: number;
  hasLocation: boolean;
  infoSlides: DetailSlideItem[];
  joinDisabled: boolean;
  joinHardDisabled: boolean;
  joinLabel: string;
  menuActions?: OverflowActionItem[];
  joinWarningMessage: string;
  joined: boolean;
  liked: boolean;
  likes: number;
  locationDisabled: boolean;
  locationWarningMessage: string;
  onJoin: () => void;
  onLike: () => void;
  onOpenAlbum: () => void;
  onAlbumDisabledPress?: () => void;
  onOpenAttendees: () => void;
  onOpenComments: () => void;
  onOpenLikes: () => void;
  onOpenLocation: () => void;
  onShowWarning?: (message: string) => void;
  showJoin: boolean;
  showSecondaryContent: boolean;
}

export function EventDetailContent({
  accessChip,
  albumCount,
  albumDisabled,
  albumWarningMessage,
  attendees,
  bodyActionsEnabled,
  capacity,
  chips,
  commentCount,
  hasLocation,
  infoSlides,
  joinDisabled,
  joinHardDisabled,
  joinLabel,
  menuActions = [],
  joinWarningMessage,
  joined,
  liked,
  likes,
  locationDisabled,
  locationWarningMessage,
  onJoin,
  onLike,
  onOpenAlbum,
  onAlbumDisabledPress,
  onOpenAttendees,
  onOpenComments,
  onOpenLikes,
  onOpenLocation,
  onShowWarning,
  showJoin,
  showSecondaryContent,
}: EventDetailContentProps) {
  return (
    <>
      {showSecondaryContent ? (
        <>
          <EventDetailInfoSlides slides={infoSlides} />
          <EventDetailMetaChips chips={chips} />
          <EventDetailAttendanceBar
            accessChip={accessChip}
            attendees={attendees}
            capacity={capacity}
            enabled={bodyActionsEnabled}
            onPress={onOpenAttendees}
          />
        </>
      ) : (
        <View style={{ marginTop: tokens.spacing.sm, gap: tokens.spacing.xs }}>
          <View
            style={{
              height: tokens.spacing.sm,
              width: "76%",
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.border,
            }}
          />
          <View
            style={{
              height: tokens.spacing.sm,
              width: "58%",
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.border,
            }}
          />
          <View
            style={{
              height: tokens.spacing.sm,
              width: "68%",
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.border,
            }}
          />
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xxs,
          paddingTop: tokens.spacing.smPlus,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.divider,
          marginTop: tokens.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs,
            flexShrink: 1,
          }}
        >
          <Pressable
            accessibilityLabel="Etkinlik beğenilerini aç"
            accessibilityRole="button"
            delayLongPress={420}
            onLongPress={onOpenLikes}
            onPress={onLike}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xxsPlus,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: tokens.spacing.compact,
              minHeight: tokens.minHeight.buttonMd,
              backgroundColor: liked ? withAlpha(tokens.colors.dangerSurface, 0.9) : "transparent",
            }}
          >
            <Heart
              size={tokens.iconSize.lg}
              color={liked ? tokens.colors.danger : tokens.colors.mutedFg}
              fill={liked ? tokens.colors.danger : "transparent"}
              strokeWidth={1.7}
            />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
                color: liked ? tokens.colors.danger : tokens.colors.muted,
              }}
            >
              {likes}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Etkinlik yorumlarını aç"
            accessibilityRole="button"
            onPress={onOpenComments}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xxsPlus,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: tokens.spacing.compact,
              minHeight: tokens.minHeight.buttonMd,
            }}
          >
            <MessageCircle
              size={tokens.iconSize.lg}
              color={tokens.colors.mutedFg}
              strokeWidth={1.7}
            />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
                color: tokens.colors.muted,
              }}
            >
              {commentCount}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Etkinlik albumunu ac"
            accessibilityRole="button"
            accessibilityState={{ disabled: albumDisabled }}
            onPress={() => {
              if (albumDisabled) {
                if (onAlbumDisabledPress) {
                  onAlbumDisabledPress();
                  return;
                }
                onShowWarning?.(albumWarningMessage);
                return;
              }
              onOpenAlbum();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xxsPlus,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: tokens.spacing.compact,
              minHeight: tokens.minHeight.buttonMd,
              opacity: albumDisabled ? 0.45 : 1,
            }}
          >
            <Images size={tokens.iconSize.lg} color={tokens.colors.mutedFg} strokeWidth={1.7} />
            <Text
              style={{
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
                color: tokens.colors.muted,
              }}
            >
              {albumCount}
            </Text>
          </Pressable>

          {hasLocation ? (
            <Pressable
              accessibilityLabel="Etkinlik konumunu aç"
              accessibilityRole="button"
              accessibilityState={{ disabled: locationDisabled }}
              onPress={() => {
                if (locationDisabled) {
                  onShowWarning?.(locationWarningMessage);
                  return;
                }
                onOpenLocation();
              }}
              style={{
                minHeight: tokens.minHeight.buttonMd,
                minWidth: tokens.minHeight.buttonMd,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: tokens.spacing.xsMinus,
                opacity: locationDisabled ? 0.45 : 1,
              }}
            >
              <MapPin size={tokens.iconSize.md} color={tokens.colors.muted} strokeWidth={1.7} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xs,
            flexShrink: 1,
          }}
        >
          {showJoin ? (
            <Pressable
              accessibilityLabel={joinLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: joinDisabled || joinHardDisabled }}
              onPress={() => {
                if (joinDisabled) {
                  onShowWarning?.(joinWarningMessage);
                  return;
                }
                onJoin();
              }}
              style={{
                borderRadius: tokens.radius.md,
                overflow: "hidden",
                minWidth: 80,
                maxWidth: 98,
                flexShrink: 1,
                opacity: joinDisabled || joinHardDisabled ? 0.72 : 1,
              }}
            >
              {joined ? (
                <View
                  style={{
                    minHeight: tokens.minHeight.header,
                    paddingHorizontal: tokens.spacing.smPlus,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tokens.colors.successSoft,
                    borderWidth: 1,
                    borderColor: tokens.colors.successBorder,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.bold,
                      color: tokens.colors.successIcon,
                    }}
                  >
                    Katıldın
                  </Text>
                </View>
              ) : joinDisabled ? (
                <View
                  style={{
                    minHeight: tokens.minHeight.header,
                    paddingHorizontal: tokens.spacing.smPlus,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tokens.colors.border,
                    borderWidth: 1,
                    borderColor: tokens.colors.borderLight,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.bold,
                      color: tokens.colors.muted,
                    }}
                  >
                    {joinLabel}
                  </Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[tokens.colors.primaryLight, tokens.colors.primary]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={{
                    minHeight: tokens.minHeight.header,
                    paddingHorizontal: tokens.spacing.smPlus,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.bold,
                      color: tokens.colors.surface,
                    }}
                  >
                    {joinLabel}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          ) : null}

          <OverflowActionMenu actions={menuActions} title="Etkinlik İşlemleri" buttonSize={32} />
        </View>
      </View>
    </>
  );
}
