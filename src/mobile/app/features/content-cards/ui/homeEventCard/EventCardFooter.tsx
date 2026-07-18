import { LinearGradient } from "expo-linear-gradient";
import { Heart, Images, MapPin, MessageCircle } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { OverflowActionMenu, type OverflowActionItem } from "../../../../shared/components";
import { renderTourAnchor, type TourAnchorRenderer } from "../tourAnchorRenderer";
import { tokens } from "../../../../shared/theme";

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
    joinLabelOverride || (joined ? "Katildin" : joinDisabled ? "Takip Gerekli" : "Katil");
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
          paddingHorizontal: 14,
          paddingBottom: tokens.spacing.sm,
          paddingTop: 10,
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
              <TouchableOpacity
                accessibilityLabel="Etkinlik beğenilerini aç"
                accessibilityRole="button"
                hitSlop={tokens.hitSlop.md}
                onPress={onLike}
                onLongPress={onLikeLongPress}
                delayLongPress={420}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: tokens.radius.pill,
                  paddingHorizontal: 10,
                  minHeight: tokens.minHeight.touchTarget,
                  backgroundColor: liked ? "rgba(254,226,226,0.9)" : "transparent",
                }}
                activeOpacity={0.7}
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
              </TouchableOpacity>
            ),
          })}

          {renderTourAnchor(anchorRenderer, {
            enabled: isTourTarget,
            tourId: "comment-button",
            children: (
              <TouchableOpacity
                accessibilityLabel="Etkinlik yorumlarını aç"
                accessibilityRole="button"
                hitSlop={tokens.hitSlop.md}
                onPress={onComment}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: tokens.radius.pill,
                  paddingHorizontal: 10,
                  minHeight: tokens.minHeight.touchTarget,
                }}
                activeOpacity={0.7}
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
              </TouchableOpacity>
            ),
          })}

          <TouchableOpacity
            accessibilityLabel="Etkinlik albümünü aç"
            accessibilityRole="button"
            accessibilityState={{ disabled: albumDisabled }}
            hitSlop={tokens.hitSlop.md}
            onPress={albumDisabled ? onAlbumDisabledPress || onAlbum : onAlbum}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: 10,
              minHeight: tokens.minHeight.touchTarget,
              opacity: albumDisabled ? 0.45 : 1,
            }}
            activeOpacity={0.7}
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
          </TouchableOpacity>

          {showLocation ? (
            <TouchableOpacity
              accessibilityLabel="Etkinlik konumunu aç"
              accessibilityRole="button"
              accessibilityState={{ disabled: locationDisabled }}
              hitSlop={tokens.hitSlop.md}
              onPress={locationDisabled ? onLocationDisabledPress || onLocation : onLocation}
              disabled={!onLocation && !onLocationDisabledPress}
              style={{
                minHeight: tokens.minHeight.touchTarget,
                minWidth: tokens.minHeight.touchTarget,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
                opacity: locationDisabled ? 0.45 : 1,
              }}
              activeOpacity={0.7}
            >
              <MapPin size={tokens.iconSize.md} color={tokens.colors.muted} strokeWidth={1.7} />
            </TouchableOpacity>
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
                  <TouchableOpacity
                    accessibilityLabel={joinLabel}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: joinButtonDisabled || joinDisabled || joinHardDisabled,
                    }}
                    hitSlop={tokens.hitSlop.md}
                    onPress={joinPressHandler}
                    disabled={joinButtonDisabled}
                    activeOpacity={0.8}
                    style={{
                      borderRadius: tokens.radius.md,
                      overflow: "hidden",
                      minWidth: 96,
                      maxWidth: 118,
                      flexShrink: 1,
                      opacity: joinDisabled || joinHardDisabled ? 0.7 : 1,
                    }}
                  >
                    {joined ? (
                      <View
                        style={{
                          minHeight: tokens.minHeight.header,
                          paddingHorizontal: 14,
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
                          Katildin
                        </Text>
                      </View>
                    ) : (
                      <>
                        {joinDisabled ? (
                          <View
                            style={{
                              minHeight: tokens.minHeight.header,
                              paddingHorizontal: 14,
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
                              paddingHorizontal: 14,
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
                  </TouchableOpacity>
                ),
              })
            : null}

          <OverflowActionMenu actions={menuActions} title="Etkinlik İşlemleri" buttonSize={32} />
        </View>
      </View>
    ),
  });
}
