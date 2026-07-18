import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image as ImageIcon, Play } from "lucide-react-native";
import { AppImage } from "../../../shared/components";
import { isVideoMediaUri } from "../../../shared/media/mediaVideoUtils";
import { VideoThumbnailPreview } from "../../../shared/media/VideoThumbnailPreview";

type Props = {
  firstImageUri?: string;
  firstImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  } | null;
  images: string[];
  onPressImage: (index: number) => void;
  photoCount: number;
  previewIndex: number;
  setPreviewIndex: (value: number) => void;
};

export function AlbumMediaCarousel({
  firstImageUri,
  firstImageVariants,
  images,
  onPressImage,
  photoCount,
  previewIndex,
  setPreviewIndex,
}: Props) {
  const mediaFrameHeight = 290;
  const listRef = useRef<FlatList<string>>(null);
  const [mediaWidth, setMediaWidth] = useState(0);
  const hasImages = images.length > 0;
  const dots = useMemo(() => images.slice(0, 6), [images]);
  const mediaCounts = useMemo(() => {
    const candidates = images.length > 0 ? images : firstImageUri ? [firstImageUri] : [];
    let photoItems = 0;
    let videoItems = 0;
    candidates.forEach((item) => {
      if (isVideoMediaUri(item)) {
        videoItems += 1;
        return;
      }
      photoItems += 1;
    });
    if (candidates.length === 0 && photoCount > 0) {
      photoItems = photoCount;
    }
    if (photoCount > candidates.length && videoItems === 0) {
      photoItems = photoCount;
    }
    return { photoItems, videoItems };
  }, [firstImageUri, images, photoCount]);

  useEffect(() => {
    if (!hasImages || mediaWidth <= 0) return;
    const targetIndex = Math.max(0, Math.min(previewIndex, images.length - 1));
    listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
  }, [hasImages, images.length, mediaWidth, previewIndex]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (mediaWidth <= 0) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / mediaWidth);
    setPreviewIndex(Math.max(0, Math.min(nextIndex, images.length - 1)));
  };

  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== mediaWidth) setMediaWidth(nextWidth);
      }}
      style={{
        width: "100%",
        height: mediaFrameHeight,
        backgroundColor: "#e2e8f0",
        position: "relative",
      }}
    >
      {hasImages && mediaWidth > 0 ? (
        <FlatList
          ref={listRef}
          bounces={false}
          data={images}
          getItemLayout={(_, index) => ({
            index,
            length: mediaWidth,
            offset: mediaWidth * index,
          })}
          horizontal
          initialNumToRender={1}
          keyExtractor={(item, index) => `${item}-${index}`}
          maxToRenderPerBatch={1}
          onMomentumScrollEnd={handleMomentumEnd}
          overScrollMode="never"
          pagingEnabled
          removeClippedSubviews
          renderItem={({ item, index }) => {
            const isLeadImage =
              index === 0 && String(firstImageUri || "").trim() === String(item || "").trim();
            const isNearViewport = Math.abs(index - previewIndex) <= 1;

            return (
              <Pressable
                onPress={() => onPressImage(index)}
                style={{ width: mediaWidth, height: mediaFrameHeight }}
              >
                {isNearViewport ? (
                  isVideoMediaUri(item) ? (
                    <View style={{ width: "100%", height: "100%", backgroundColor: "#0f172a" }}>
                      <VideoThumbnailPreview
                        candidateUris={
                          isLeadImage
                            ? [
                                firstImageVariants?.thumbnail,
                                firstImageVariants?.medium,
                                firstImageVariants?.full,
                              ]
                            : undefined
                        }
                        uri={item}
                        contentFit="cover"
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
                        }}
                      >
                        <Play size={34} color="#fff" />
                        <Text
                          style={{ marginTop: 8, color: "#fff", fontSize: 12, fontWeight: "700" }}
                        >
                          Video
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <AppImage
                      uri={item}
                      variants={isLeadImage ? firstImageVariants : undefined}
                      variant="medium"
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  )
                ) : (
                  <View style={{ width: "100%", height: "100%", backgroundColor: "#e2e8f0" }} />
                )}
              </Pressable>
            );
          }}
          showsHorizontalScrollIndicator={false}
          windowSize={3}
        />
      ) : null}

      {photoCount > 1 ? (
        <View style={{ position: "absolute", top: 8, right: 8 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 10,
              fontWeight: "700",
              backgroundColor: "rgba(15,23,42,0.62)",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            {Math.min(previewIndex + 1, photoCount)}/{photoCount}
          </Text>
        </View>
      ) : null}

      {mediaCounts.photoItems > 0 || mediaCounts.videoItems > 0 ? (
        <View style={{ position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 6 }}>
          {mediaCounts.photoItems > 0 ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(15,23,42,0.72)",
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ImageIcon size={10} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                {mediaCounts.photoItems}
              </Text>
            </View>
          ) : null}
          {mediaCounts.videoItems > 0 ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(15,23,42,0.72)",
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Play size={10} color="#fff" fill="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                {mediaCounts.videoItems}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {photoCount > 1 && dots.length > 1 ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 10,
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {dots.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={{
                width: index === previewIndex ? 18 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: index === previewIndex ? "#fff" : "rgba(255,255,255,0.48)",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
