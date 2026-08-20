import { LinearGradient } from "expo-linear-gradient";
import { Heart, Images, MapPin, MessageCircle } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import {
  InstantPressable,
  OverflowActionMenu,
  type OverflowActionItem,
} from "../../../../shared/components";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import { tokens, withAlpha } from "../../../../shared/theme";

interface Props {
  liked: boolean;
  likes: number;
  onLike: () => void;
  onLikeLongPress?: () => void;
  comments: number;
  onComment: () => void;
  onAlbum: () => void;
  onAlbumDisabledPress?: () => void;
  albumDisabled?: boolean;
  onLocation?: () => void;
  onLocationDisabledPress?: () => void;
  locationDisabled?: boolean;
  showLocation?: boolean;
  albumCount?: number;
  joined: boolean;
  onJoin: () => void;
  onJoinDisabledPress?: () => void;
  joinDisabled?: boolean;
  joinHardDisabled?: boolean;
  joinLabelOverride?: string;
  menuActions?: OverflowActionItem[];
  showJoin?: boolean;
  isTourTarget?: boolean;
  renderTourAnchor?: TourAnchorRenderer;
}

export function EventCardFooter({
  liked,
  likes,
  comments,
  onLike,
  onLikeLongPress,
  onComment,
  onAlbum,
  onAlbumDisabledPress,
  albumDisabled = false,
  onLocation,
  onLocationDisabledPress,
  locationDisabled = false,
  showLocation = false,
  albumCount = 0,
  joined,
  onJoin,
  onJoinDisabledPress,
  joinDisabled = false,
  joinHardDisabled = false,
  joinLabelOverride,
  menuActions = [],
  showJoin = true,
  isTourTarget = false,
  renderTourAnchor: anchorRenderer,
}: Props) {
  const joinLabel =
    joinLabelOverride || (joined ? "Katıldın" : joinDisabled ? "Takip Gerekli" : "Katıl");
  const joinPressHandler = joinDisabled ? onJoinDisabledPress || onJoin : onJoin;
  const joinButtonDisabled = !joinPressHandler;

  return renderTourAnchor(anchorRenderer, {
    enabled: isTourTarget,
    tourId: "quick-actions",
    children: (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xxs,
          paddingHorizontal: tokens.spacing.smPlus,
          paddingBottom: tokens.spacing.sm,
          paddingTop: tokens.spacing.compact,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.divider,
          marginTop: tokens.spacing.xs,
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
          {renderTourAnchor(anchorRenderer, {
            enabled: isTourTarget,
            tourId: "like-button",
            children: (
              <InstantPressable
                accessibilityLabel="Etkinlik beğenilerini aç"
                accessibilityRole="button"
                hitSlop={tokens.hitSlop.md}
                onPress={onLike}
                onLongPress={onLikeLongPress}
                delayLongPress={420}
                haptic="light"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xsMinus,
                  borderRadius: tokens.radius.pill,
                  paddingHorizontal: tokens.spacing.compact,
                  minHeight: tokens.minHeight.buttonMd,
                  backgroundColor: liked
                    ? withAlpha(tokens.colors.dangerSurface, 0.9)
                    : "transparent",
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
              </InstantPressable>
            ),
          })}

          {renderTourAnchor(anchorRenderer, {
            enabled: isTourTarget,
            tourId: "comment-button",
            children: (
              <InstantPressable
                accessibilityLabel="Etkinlik yorumlarını aç"
                accessibilityRole="button"
                hitSlop={tokens.hitSlop.md}
                onPress={onComment}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.spacing.xsMinus,
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
                  {comments}
                </Text>
              </InstantPressable>
            ),
          })}

          <InstantPressable
            accessibilityLabel="Etkinlik albümünü aç"
            accessibilityRole="button"
            accessibilityState={{ disabled: albumDisabled }}
            hitSlop={tokens.hitSlop.md}
            onPress={albumDisabled ? onAlbumDisabledPress || onAlbum : onAlbum}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.xsMinus,
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
          </InstantPressable>

          {showLocation ? (
            <InstantPressable
              accessibilityLabel="Etkinlik konumunu aç"
              accessibilityRole="button"
              accessibilityState={{ disabled: locationDisabled }}
              hitSlop={tokens.hitSlop.md}
              onPress={locationDisabled ? onLocationDisabledPress || onLocation : onLocation}
              disabled={!onLocation && !onLocationDisabledPress}
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
            </InstantPressable>
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
          {showJoin
            ? renderTourAnchor(anchorRenderer, {
                enabled: isTourTarget,
                tourId: "join-button",
                children: (
                  <InstantPressable
                    accessibilityLabel={joinLabel}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: joinButtonDisabled || joinDisabled || joinHardDisabled,
                    }}
                    hitSlop={tokens.hitSlop.md}
                    onPress={joinPressHandler}
                    disabled={joinButtonDisabled}
                    haptic="selection"
                    style={{
                      borderRadius: tokens.radius.md,
                      overflow: "hidden",
                      minWidth: 80,
                      maxWidth: 98,
                      flexShrink: 1,
                      opacity: joinDisabled || joinHardDisabled ? 0.7 : 1,
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
                    ) : (
                      <>
                        {joinDisabled ? (
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
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
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
                      </>
                    )}
                  </InstantPressable>
                ),
              })
            : null}

          <OverflowActionMenu actions={menuActions} title="Etkinlik İşlemleri" buttonSize={32} />
        </View>
      </View>
    ),
  });
}
