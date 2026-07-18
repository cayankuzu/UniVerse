import { useEffect, useState } from "react";
import { Image as ImageIcon, Play } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { AppImage } from "../../../../shared/components";
import { isVideoMediaUri } from "../../../../shared/media/mediaVideoUtils";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import type { EventWithMeta } from "../../data";

interface EventDetailImageProps {
  event: EventWithMeta;
  imageVariant?: "thumbnail" | "medium" | "full";
  onLongPress?: () => void;
  onPress: () => void;
}

export function EventDetailImage({
  event,
  imageVariant = "medium",
  onLongPress,
  onPress,
}: EventDetailImageProps) {
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
      onLongPress={onLongPress}
      delayLongPress={220}
      activeOpacity={0.9}
      style={{ height: 208, backgroundColor: "#e2e8f0", overflow: "hidden" }}
    >
      {canShowImage ? (
        isVideoMediaUri(event.image || "") ? (
          <View style={{ width: "100%", height: "100%" }}>
            <VideoThumbnailPreview
              candidateUris={[
                event.imageVariants?.thumbnail,
                event.imageVariants?.medium,
                event.imageVariants?.full,
              ]}
              uri={event.image || ""}
              priority="eager"
              style={{ width: "100%", height: "100%" }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(15,23,42,0.18)",
              }}
            >
              <Play size={34} color="#ffffff" strokeWidth={1.8} />
            </View>
          </View>
        ) : (
          <AppImage
            uri={event.image}
            variants={event.imageVariants}
            variant={imageVariant}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        )
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ImageIcon size={28} color="#94a3b8" strokeWidth={1.5} />
        </View>
      )}
    </TouchableOpacity>
  );
}
