import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { canUseMediaUriDirectly, normalizeMediaUriInput } from "./mediaUri";
import { useResolvedMediaUri } from "./useResolvedMediaUri";
import { VideoThumbnailPreview } from "./VideoThumbnailPreview";

type Props = {
  autoPlay?: boolean;
  contentFit?: "contain" | "cover";
  muted?: boolean;
  nativeControls?: boolean;
  style?: ViewStyle;
  uri: string;
};

export function MediaVideo({
  autoPlay = false,
  contentFit = "contain",
  muted = false,
  nativeControls = true,
  style,
  uri,
}: Props) {
  const resolvedUri = useResolvedMediaUri(uri, {
    priority: "eager",
    retry: true,
  });
  const normalizedUri = normalizeMediaUriInput(uri);
  const sourceUri = resolvedUri || (canUseMediaUriDirectly(normalizedUri) ? normalizedUri : "");
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const player = useVideoPlayer(sourceUri || null, (instance) => {
    instance.loop = false;
    instance.muted = muted;
  });

  useEffect(() => {
    setFirstFrameRendered(false);
    player.muted = muted;
    if (autoPlay && sourceUri) {
      player.play();
    }
  }, [autoPlay, muted, player, sourceUri]);

  if (!normalizedUri) {
    return (
      <View
        style={[
          { alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
          style,
        ]}
      >
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Video bulunamadı</Text>
      </View>
    );
  }

  if (!sourceUri) {
    return (
      <View
        style={[
          { alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
          style,
        ]}
      >
        <VideoThumbnailPreview
          contentFit={contentFit}
          priority="eager"
          style={StyleSheet.absoluteFillObject}
          uri={uri}
        />
        <View
          pointerEvents="none"
          style={{
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15,23,42,0.18)",
            ...StyleSheet.absoluteFillObject,
          }}
        >
          <ActivityIndicator color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: "#0f172a" }, style]}>
      {!firstFrameRendered ? (
        <VideoThumbnailPreview
          contentFit={contentFit}
          priority="eager"
          style={StyleSheet.absoluteFillObject}
          uri={sourceUri}
        />
      ) : null}
      {!firstFrameRendered ? (
        <View
          pointerEvents="none"
          style={{
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15,23,42,0.18)",
            ...StyleSheet.absoluteFillObject,
          }}
        >
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      <VideoView
        contentFit={contentFit}
        fullscreenOptions={{ enable: true }}
        nativeControls={nativeControls}
        onFirstFrameRender={() => setFirstFrameRendered(true)}
        player={player}
        style={[StyleSheet.absoluteFillObject, { opacity: firstFrameRendered ? 1 : 0 }]}
        useExoShutter={false}
      />
    </View>
  );
}
