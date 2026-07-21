import React, { useEffect, useMemo, useState } from "react";
import { AppText as Text } from "../components/AppText";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { setVideoCacheSizeAsync, VideoView, useVideoPlayer } from "expo-video";
import { tokens, withAlpha } from "../theme";
import { canUseMediaUriDirectly, normalizeMediaUriInput } from "./mediaUri";
import { useResolvedMediaUri } from "./useResolvedMediaUri";
import { VideoThumbnailPreview } from "./VideoThumbnailPreview";

type Props = {
  active?: boolean;
  autoPlay?: boolean;
  cacheEnabled?: boolean;
  contentFit?: "contain" | "cover";
  muted?: boolean;
  nativeControls?: boolean;
  style?: ViewStyle;
  uri: string;
};

const APP_VIDEO_CACHE_BYTES = 256 * 1024 * 1024;
let videoCacheConfigured = false;

function configureVideoCache() {
  if (videoCacheConfigured) return;
  videoCacheConfigured = true;
  void setVideoCacheSizeAsync(APP_VIDEO_CACHE_BYTES).catch(() => {
    videoCacheConfigured = false;
  });
}

export function MediaVideo({
  active = true,
  autoPlay = false,
  cacheEnabled = true,
  contentFit = "contain",
  muted = false,
  nativeControls = true,
  style,
  uri,
}: Props) {
  useEffect(configureVideoCache, []);
  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive",
  );
  const resolvedUri = useResolvedMediaUri(uri, {
    priority: "eager",
    retry: true,
  });
  const normalizedUri = normalizeMediaUriInput(uri);
  const sourceUri = resolvedUri || (canUseMediaUriDirectly(normalizedUri) ? normalizedUri : "");
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const shouldAttachPlayer = active && appActive && Boolean(sourceUri);
  const playerSource = useMemo(() => {
    if (!shouldAttachPlayer) return null;
    const isRemote = /^https?:/i.test(sourceUri);
    const isIosHls = Platform.OS === "ios" && /\.m3u8(?:$|\?)/i.test(sourceUri);
    return {
      uri: sourceUri,
      useCaching: Boolean(cacheEnabled && isRemote && !isIosHls),
    };
  }, [cacheEnabled, shouldAttachPlayer, sourceUri]);
  const player = useVideoPlayer(playerSource, (instance) => {
    instance.loop = false;
    instance.muted = muted;
  });

  useEffect(() => {
    setFirstFrameRendered(false);
  }, [shouldAttachPlayer, sourceUri]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (shouldAttachPlayer && autoPlay) {
      player.play();
      return;
    }
    player.pause();
  }, [autoPlay, player, shouldAttachPlayer]);

  useEffect(
    () => () => {
      player.pause();
    },
    [player],
  );

  if (!normalizedUri) {
    return (
      <View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.colors.dark900,
          },
          style,
        ]}
      >
        <Text
          style={{
            color: tokens.colors.onMedia,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          Video bulunamadı
        </Text>
      </View>
    );
  }

  if (!sourceUri) {
    return (
      <View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.colors.dark900,
          },
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
            backgroundColor: withAlpha(tokens.colors.foreground, 0.18),
            ...StyleSheet.absoluteFillObject,
          }}
        >
          <ActivityIndicator color={tokens.colors.onMedia} />
        </View>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: tokens.colors.dark900 }, style]}>
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
            backgroundColor: withAlpha(tokens.colors.foreground, 0.18),
            ...StyleSheet.absoluteFillObject,
          }}
        >
          <ActivityIndicator color={tokens.colors.onMedia} />
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
