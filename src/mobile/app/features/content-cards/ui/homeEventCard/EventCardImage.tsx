import { useEffect, useState } from "react";
import { Image as ImageIcon, Play } from "lucide-react-native";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { EventWithMeta } from "../../data";
import { AppImage } from "../../../../shared/components";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import { tokens, withAlpha } from "../../../../shared/theme";

interface Props {
  event: EventWithMeta;
  highPriority?: boolean;
  imageVariant?: "thumbnail" | "medium" | "full";
  onPress: () => void;
  onLongPress?: () => void;
}

export function EventCardImage({
  event,
  highPriority = false,
  imageVariant = "medium",
  onPress,
  onLongPress,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const canShowImage = !!event.image && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [
    event.id,
    event.image,
    event.imageVariants?.full,
    event.imageVariants?.medium,
    event.imageVariants?.thumbnail,
  ]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title || "Etkinlik"} medyasını aç`}
      onLongPress={onLongPress}
      delayLongPress={220}
      activeOpacity={0.9}
      style={styles.container}
    >
      {canShowImage ? (
        isVideoMediaUri(event.image || "") ? (
          <View style={styles.videoFrame}>
            <VideoThumbnailPreview
              candidateUris={[
                event.imageVariants?.thumbnail,
                event.imageVariants?.medium,
                event.imageVariants?.full,
              ]}
              uri={event.image || ""}
              priority={highPriority ? "eager" : "deferred"}
              style={{ width: "100%", height: "100%" }}
            />
            <View style={styles.videoOverlay}>
              <Play size={tokens.iconSize["3xl"]} color={tokens.colors.surface} strokeWidth={1.8} />
            </View>
          </View>
        ) : (
          <AppImage
            highPriority={highPriority}
            uri={event.image}
            variants={event.imageVariants}
            variant={imageVariant}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        )
      ) : (
        <View style={styles.fallback}>
          <ImageIcon
            size={tokens.iconSize["2xl"]}
            color={tokens.colors.mutedFg}
            strokeWidth={1.5}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.border,
    height: 188,
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  videoFrame: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(tokens.colors.foreground, 0.18),
  },
});
