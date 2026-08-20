import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Play, Image as ImageIcon } from "lucide-react-native";
import { Image, Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { THUMB_SIZE } from "../../domain/eventAlbumDragLayout";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";

type Props = {
  candidateUris?: string[];
  kind?: "image" | "video";
  uri: string;
  index: number;
  selected: boolean;
  swapSource?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function EventAlbumDraggableThumb({
  candidateUris,
  kind,
  uri,
  index,
  selected,
  swapSource = false,
  disabled,
  onLongPress,
  onPress,
}: Props) {
  const video = kind === "video" || isVideoMediaUri(uri);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${index + 1}. medya${selected ? ", seçili" : ""}`}
      accessibilityHint="Sıralamak için basılı tut"
      accessibilityState={{ disabled, selected }}
      onLongPress={onLongPress}
      delayLongPress={500}
      hitSlop={4}
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: tokens.radius.lg,
        overflow: "hidden",
        borderWidth: selected || swapSource ? 2 : 1,
        borderColor: swapSource
          ? tokens.colors.successDark
          : selected
            ? tokens.colors.primary
            : tokens.colors.borderLight,
        backgroundColor: tokens.colors.border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {video ? (
        <VideoThumbnailPreview
          candidateUris={candidateUris}
          contentFit="cover"
          priority="deferred"
          style={{ width: "100%", height: "100%" }}
          uri={uri}
        />
      ) : (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      )}
      <View
        style={{
          position: "absolute",
          left: 4,
          bottom: 4,
          borderRadius: tokens.radius.pill,
          backgroundColor: tokens.colors.backdrop,
          paddingHorizontal: tokens.spacing.xsMinus,
          paddingVertical: tokens.spacing.microPlus,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xxs,
        }}
      >
        {video ? (
          <Play size={10} color={tokens.colors.surface} fill={tokens.colors.surface} />
        ) : (
          <ImageIcon size={10} color={tokens.colors.surface} />
        )}
      </View>
      <View
        style={{
          position: "absolute",
          right: 4,
          top: 4,
          borderRadius: tokens.radius.pill,
          backgroundColor: tokens.colors.backdrop,
          paddingHorizontal: tokens.spacing.xsMinus,
          paddingVertical: tokens.spacing.micro,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.microPlus,
        }}
      >
        <Text
          style={{
            color: tokens.colors.surface,
            fontSize: tokens.typography.nano,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          {index + 1}
        </Text>
      </View>
    </Pressable>
  );
}
