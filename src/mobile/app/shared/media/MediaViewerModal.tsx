import { ArrowLeft } from "lucide-react-native";
import { AppText as Text } from "../components/AppText";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, StatusBar, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIconButton } from "../components/AppIconButton";
import { AppModalHost } from "../components/AppModalHost";
import { OverflowActionMenu, type OverflowActionItem } from "../components/OverflowActionMenu";
import { AppImage } from "../components/AppImage";
import { t } from "../i18n";
import { tokens, withAlpha } from "../theme";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";
import { isVideoMediaUri } from "./mediaVideoUtils";
import { VideoThumbnailPreview } from "./VideoThumbnailPreview";

type MediaVideoComponent = typeof import("./MediaVideo").MediaVideo;
let loadedMediaVideo: MediaVideoComponent | null = null;

function getMediaVideo() {
  loadedMediaVideo ||= require("./MediaVideo").MediaVideo as MediaVideoComponent;
  return loadedMediaVideo;
}

function DeferredMediaVideo(props: React.ComponentProps<MediaVideoComponent>) {
  const [MediaVideo, setMediaVideo] = useState<MediaVideoComponent | null>(loadedMediaVideo);

  useEffect(() => {
    if (MediaVideo) return;
    const task = scheduleAfterInteractions(() => {
      setMediaVideo(() => getMediaVideo());
    }, 24);
    return task.cancel;
  }, [MediaVideo]);

  return MediaVideo ? (
    <MediaVideo {...props} />
  ) : (
    <VideoThumbnailPreview
      contentFit={props.contentFit}
      priority="eager"
      style={props.style}
      uri={props.uri}
    />
  );
}

export type MediaViewerItem = {
  kind?: "image" | "video";
  label?: string;
  uri: string;
};

type Props = {
  actions?: OverflowActionItem[];
  initialIndex?: number;
  items: MediaViewerItem[];
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  visible: boolean;
};

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function isDirectLocalMediaUri(uri: string) {
  return /^(file:|content:|asset:|ph:)/i.test(String(uri || "").trim());
}

export function MediaViewerModal({
  actions = [],
  initialIndex = 0,
  items,
  onClose,
  onIndexChange,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const listRef = useRef<FlatList<MediaViewerItem>>(null);
  const lastEmittedIndexRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(initialIndex, items.length));

  const resolvedItems = useMemo(
    () =>
      items
        .map((item) => ({
          kind: item.kind || (isVideoMediaUri(item.uri) ? "video" : "image"),
          label: item.label,
          uri: String(item.uri || "").trim(),
        }))
        .filter((item) => Boolean(item.uri)),
    [items],
  );

  const activeIndex = clampIndex(currentIndex, resolvedItems.length);
  const activeItem = resolvedItems[activeIndex] || null;

  useEffect(() => {
    if (!visible || resolvedItems.length === 0) {
      lastEmittedIndexRef.current = null;
      return;
    }
    const nextIndex = clampIndex(initialIndex, resolvedItems.length);
    setCurrentIndex(nextIndex);
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ animated: false, index: nextIndex });
    }, tokens.duration.fast / 3);
    return () => clearTimeout(timer);
  }, [initialIndex, resolvedItems.length, visible]);

  useEffect(() => {
    if (!visible || resolvedItems.length === 0) return;
    if (lastEmittedIndexRef.current === activeIndex) return;
    lastEmittedIndexRef.current = activeIndex;
    onIndexChange?.(activeIndex);
  }, [activeIndex, onIndexChange, resolvedItems.length, visible]);

  if (!visible) return null;

  return (
    <AppModalHost
      accessibilityAnnouncement={t("media.viewer.preview")}
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        accessibilityLabel="Medya önizleme"
        accessibilityRole="image"
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: tokens.colors.overlayHeavy }}
      >
        <StatusBar barStyle="light-content" />
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            paddingTop: Math.max(insets.top + 10, 18),
            paddingHorizontal: tokens.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.compact,
            }}
          >
            <AppIconButton
              accessibilityLabel={t("media.viewer.back")}
              icon={({ color, size }) => <ArrowLeft color={color} size={size} strokeWidth={2.1} />}
              iconColor={tokens.colors.surface}
              outlineColor={withAlpha(tokens.colors.textSubtle, 0.22)}
              onPress={onClose}
              size={tokens.iconSize["4xl"]}
              surfaceColor={tokens.colors.backdropLight}
            />

            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {resolvedItems.length > 1 ? (
                <View
                  style={{
                    borderRadius: tokens.radius.pill,
                    backgroundColor: withAlpha(tokens.colors.foreground, 0.68),
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: tokens.spacing.xsMinus,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.colors.surface,
                      fontSize: tokens.typography.caption,
                      fontWeight: tokens.fontWeight.extrabold,
                    }}
                  >
                    {activeIndex + 1} / {resolvedItems.length}
                  </Text>
                </View>
              ) : null}
            </View>

            <OverflowActionMenu
              actions={actions}
              disabled={!actions.length}
              buttonSize={tokens.iconSize["4xl"]}
            />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={resolvedItems}
          horizontal
          pagingEnabled
          bounces={false}
          getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
          initialNumToRender={1}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={(event) => {
            const nextIndex = clampIndex(
              Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)),
              resolvedItems.length,
            );
            setCurrentIndex(nextIndex);
          }}
          renderItem={({ index, item }) => (
            <View
              style={{
                width,
                height,
                paddingTop: Math.max(insets.top + 72, 96),
                paddingBottom: Math.max(insets.bottom + tokens.spacing.xl, tokens.spacing.xxl),
                paddingHorizontal: tokens.spacing.md,
              }}
            >
              <View
                style={{
                  flex: 1,
                  overflow: "hidden",
                  borderRadius: tokens.radius["2xl"],
                  backgroundColor: tokens.colors.dark900,
                  borderWidth: 1,
                  borderColor: withAlpha(tokens.colors.textSubtle, 0.18),
                }}
              >
                {item.kind === "video" ? (
                  <DeferredMediaVideo
                    active={index === activeIndex}
                    autoPlay
                    contentFit="contain"
                    muted={false}
                    nativeControls
                    style={{ width: "100%", height: "100%" }}
                    uri={item.uri}
                  />
                ) : isDirectLocalMediaUri(item.uri) ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                ) : (
                  <AppImage
                    highPriority
                    uri={item.uri}
                    variant="full"
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                )}
              </View>
            </View>
          )}
          scrollEventThrottle={tokens.spacing.md}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        />

        {activeItem?.label ? (
          <View
            style={{
              position: "absolute",
              left: tokens.spacing.md,
              right: tokens.spacing.md,
              bottom: Math.max(insets.bottom + tokens.spacing.md, 18),
              alignItems: "center",
            }}
          >
            <View
              style={{
                maxWidth: "100%",
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.backdropLight,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: tokens.spacing.xs,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                  lineHeight: tokens.lineHeight.tiny,
                }}
                numberOfLines={2}
              >
                {activeItem.label}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </AppModalHost>
  );
}
