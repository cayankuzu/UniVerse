import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Crop, ImagePlus, Trash2 } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as NativeScrollView,
} from "react-native";
import { AppScrollView as ScrollView } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
import { EventAlbumActionButton } from "./EventAlbumActionButton";
import { EventAlbumDraggableThumb } from "./EventAlbumDraggableThumb";
import { clampAlbumThumbIndex } from "../../domain";
import { logAlbumMediaDebug, warnAlbumMediaDebug } from "../../application/mediaDebug";
import { formatMediaDuration } from "../../../../shared/media/mediaVideoUtils";
import {
  isVideoMediaUri,
  resolveMediaSelectionPreviewCandidates,
  resolveMediaSelectionPreviewUri,
  type MediaSelection,
} from "../../../../shared/media/mediaPicker";
import { MediaViewerModal, type MediaViewerItem } from "../../../../shared/media/MediaViewerModal";
import { VideoThumbnailPreview } from "../../../../shared/media/VideoThumbnailPreview";
import { useAlbumPreviewViewerActions } from "./useAlbumPreviewViewerActions";

type Props = {
  cropPending: boolean;
  handleThumbPress: (index: number) => void;
  onCropSelectedPhoto: (index: number, uri: string) => void;
  onPickPhotos: () => void;
  onPreviewWidthChange: (width: number) => void;
  onRemoveSelectedPhoto: (index: number) => void;
  onSelectPhoto: (index: number) => void;
  onLongPressPhoto: (index: number) => void;
  previewWidth: number;
  selectedMediaItems: MediaSelection[];
  swapSourceIndex: number | null;
  selectedPhotoIndex: number;
  selectedPhotoUris: string[];
  uploadPending: boolean;
};

export function EventAlbumUploadPreviewSection({
  cropPending,
  handleThumbPress,
  onCropSelectedPhoto,
  onPickPhotos,
  onPreviewWidthChange,
  onRemoveSelectedPhoto,
  onSelectPhoto,
  onLongPressPhoto,
  previewWidth,
  selectedMediaItems,
  swapSourceIndex,
  selectedPhotoIndex,
  selectedPhotoUris,
  uploadPending,
}: Props) {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const previewScrollRef = useRef<NativeScrollView | null>(null);
  const lastPreviewSyncKeyRef = useRef("");
  const pendingProgrammaticIndexRef = useRef<number | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const previewMediaItems = useMemo<MediaSelection[]>(
    () =>
      selectedMediaItems.length > 0
        ? selectedMediaItems
        : selectedPhotoUris.map((uri) => ({
            kind: isVideoMediaUri(uri) ? ("video" as const) : ("image" as const),
            previewUri: uri,
            uri,
          })),
    [selectedMediaItems, selectedPhotoUris],
  );
  const normalizedSelectedPhotoIndex =
    previewMediaItems.length > 0
      ? clampAlbumThumbIndex(selectedPhotoIndex, 0, previewMediaItems.length - 1)
      : 0;
  const resolvedPreviewWidth = previewWidth || Math.max(Math.round(windowWidth - 32), 1);
  const selectedMediaItem = previewMediaItems[normalizedSelectedPhotoIndex] || null;
  const selectedPhotoUri = selectedMediaItem?.uri || "";
  const selectedIsVideo = selectedMediaItem?.kind === "video";
  const selectedVideoDurationLabel = selectedIsVideo
    ? formatMediaDuration(selectedMediaItem?.durationMs)
    : "";
  const actionsDisabled = uploadPending || cropPending;
  const canCropSelectedPhoto = Boolean(selectedPhotoUri) && !selectedIsVideo && !actionsDisabled;
  const viewerItems = useMemo<MediaViewerItem[]>(
    () =>
      previewMediaItems.map((item) => ({
        kind: item.kind,
        label: item.fileName || undefined,
        uri: resolveMediaSelectionPreviewUri(item),
      })),
    [previewMediaItems],
  );
  const activeViewerIndex =
    viewerItems.length > 0 ? clampAlbumThumbIndex(viewerIndex, 0, viewerItems.length - 1) : 0;
  const activeViewerItem = viewerItems[activeViewerIndex] || null;

  useEffect(() => {
    if (
      selectedMediaItems.length > 0 &&
      selectedPhotoUris.length > 0 &&
      selectedMediaItems.length !== selectedPhotoUris.length
    ) {
      warnAlbumMediaDebug("preview-media-length-mismatch", {
        selectedMediaItemCount: selectedMediaItems.length,
        selectedPhotoUriCount: selectedPhotoUris.length,
      });
    }
  }, [selectedMediaItems.length, selectedPhotoUris.length]);

  useEffect(() => {
    if (!fullscreenVisible) {
      setViewerIndex(normalizedSelectedPhotoIndex);
    }
  }, [fullscreenVisible, normalizedSelectedPhotoIndex]);

  useEffect(() => {
    logAlbumMediaDebug("preview-state-sync", {
      cropPending,
      previewItemCount: previewMediaItems.length,
      selectedIndex: normalizedSelectedPhotoIndex,
      selectedUri: selectedPhotoUri,
      swapSourceIndex,
      uploadPending,
    });
  }, [
    cropPending,
    normalizedSelectedPhotoIndex,
    previewMediaItems.length,
    selectedPhotoUri,
    swapSourceIndex,
    uploadPending,
  ]);

  const updateSelectedIndex = useCallback(
    (index: number, reason: string) => {
      if (!previewMediaItems.length) return;
      const nextIndex = clampAlbumThumbIndex(index, 0, previewMediaItems.length - 1);
      logAlbumMediaDebug("preview-index-request", {
        currentIndex: normalizedSelectedPhotoIndex,
        nextIndex,
        previewItemCount: previewMediaItems.length,
        reason,
      });
      if (nextIndex !== normalizedSelectedPhotoIndex) {
        onSelectPhoto(nextIndex);
      }
    },
    [normalizedSelectedPhotoIndex, onSelectPhoto, previewMediaItems.length],
  );

  const handlePreviewScrollBeginDrag = useCallback(() => {
    pendingProgrammaticIndexRef.current = null;
    logAlbumMediaDebug("preview-scroll-begin-drag", {
      currentIndex: normalizedSelectedPhotoIndex,
    });
  }, [normalizedSelectedPhotoIndex]);

  const focusPreviewIndex = useCallback(
    (index: number, animated = false, reason = "state-sync") => {
      if (!previewMediaItems.length) return;
      const nextIndex = clampAlbumThumbIndex(index, 0, previewMediaItems.length - 1);
      pendingProgrammaticIndexRef.current = nextIndex;
      logAlbumMediaDebug("preview-scroll-to-index", {
        animated,
        nextIndex,
        previewWidth: resolvedPreviewWidth,
        reason,
      });
      previewScrollRef.current?.scrollTo({
        animated,
        x: nextIndex * resolvedPreviewWidth,
        y: 0,
      });
    },
    [previewMediaItems.length, resolvedPreviewWidth],
  );

  const handlePreviewScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!previewMediaItems.length) return;
      const pageWidth = Math.max(
        Math.round(event.nativeEvent.layoutMeasurement.width || resolvedPreviewWidth),
        1,
      );
      const offsetX = Math.max(0, event.nativeEvent.contentOffset.x || 0);
      const nextIndex = clampAlbumThumbIndex(
        Math.round(offsetX / pageWidth),
        0,
        previewMediaItems.length - 1,
      );
      const expectedProgrammaticIndex = pendingProgrammaticIndexRef.current;
      if (
        typeof expectedProgrammaticIndex === "number" &&
        expectedProgrammaticIndex !== nextIndex
      ) {
        warnAlbumMediaDebug("preview-scroll-end-ignored", {
          currentIndex: normalizedSelectedPhotoIndex,
          expectedProgrammaticIndex,
          nextIndex,
          offsetX,
          pageWidth,
        });
        return;
      }
      pendingProgrammaticIndexRef.current = null;
      logAlbumMediaDebug("preview-scroll-end", {
        currentIndex: normalizedSelectedPhotoIndex,
        nextIndex,
        offsetX,
        pageWidth,
      });
      updateSelectedIndex(nextIndex, "preview-scroll-end");
    },
    [
      normalizedSelectedPhotoIndex,
      previewMediaItems.length,
      resolvedPreviewWidth,
      updateSelectedIndex,
    ],
  );

  useEffect(() => {
    if (!previewMediaItems.length || !resolvedPreviewWidth) {
      lastPreviewSyncKeyRef.current = "";
      pendingProgrammaticIndexRef.current = null;
      return;
    }

    const nextSyncKey = `${previewMediaItems.length}:${resolvedPreviewWidth}:${normalizedSelectedPhotoIndex}`;
    if (lastPreviewSyncKeyRef.current === nextSyncKey) {
      return;
    }
    lastPreviewSyncKeyRef.current = nextSyncKey;

    const frame = requestAnimationFrame(() => {
      focusPreviewIndex(normalizedSelectedPhotoIndex, false, "state-sync");
    });
    return () => cancelAnimationFrame(frame);
  }, [
    focusPreviewIndex,
    normalizedSelectedPhotoIndex,
    previewMediaItems.length,
    resolvedPreviewWidth,
  ]);

  const viewerActions = useAlbumPreviewViewerActions({
    activeViewerIndex,
    activeViewerItem,
    onCloseViewer: () => setFullscreenVisible(false),
    onRemoveSelectedPhoto,
  });

  return (
    <>
      <View
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth) onPreviewWidthChange(nextWidth);
        }}
        style={{
          width: "100%",
          aspectRatio: 1.2,
          borderRadius: tokens.radius.lg,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          backgroundColor: tokens.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {previewMediaItems.length > 0 ? (
          <>
            <ScrollView
              ref={previewScrollRef}
              horizontal
              directionalLockEnabled
              decelerationRate="fast"
              disableIntervalMomentum
              nestedScrollEnabled
              onScrollBeginDrag={handlePreviewScrollBeginDrag}
              onMomentumScrollEnd={handlePreviewScrollEnd}
              pagingEnabled
              scrollEnabled={!actionsDisabled}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              style={{ width: "100%", height: "100%" }}
            >
              {previewMediaItems.map((item, index) => (
                <Pressable
                  key={`${item.uri}-${index}`}
                  onPress={() => {
                    updateSelectedIndex(index, "preview-open-viewer");
                    setViewerIndex(index);
                    setFullscreenVisible(true);
                  }}
                  style={{ width: resolvedPreviewWidth, height: "100%" }}
                >
                  {item.kind === "video" ? (
                    <VideoThumbnailPreview
                      candidateUris={resolveMediaSelectionPreviewCandidates(item)}
                      contentFit="cover"
                      priority="eager"
                      uri={resolveMediaSelectionPreviewUri(item)}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Image
                      source={{ uri: resolveMediaSelectionPreviewUri(item) }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <View
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.backdropLight,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.surface,
                  fontSize: tokens.typography.tiny,
                  fontWeight: tokens.fontWeight.bold,
                }}
              >
                {normalizedSelectedPhotoIndex + 1} / {previewMediaItems.length}
              </Text>
            </View>
            {selectedVideoDurationLabel ? (
              <View
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 10,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.colors.backdropLight,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.surface,
                    fontSize: tokens.typography.tiny,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {selectedVideoDurationLabel}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={onPickPhotos}
            style={{ alignItems: "center", justifyContent: "center" }}
          >
            <Camera size={tokens.iconSize["3xl"]} color={tokens.colors.mutedFg} />
            <Text
              style={{
                marginTop: tokens.spacing.xs,
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
              }}
            >
              Medya ekle
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: tokens.spacing.xs }}>
        <EventAlbumActionButton
          disabled={actionsDisabled}
          icon={<ImagePlus size={tokens.iconSize.md} color={tokens.colors.primary} />}
          label="Medya Ekle"
          onPress={onPickPhotos}
        />
        <EventAlbumActionButton
          disabled={!canCropSelectedPhoto}
          loading={cropPending}
          icon={
            cropPending ? (
              <ActivityIndicator size="small" color={tokens.colors.primary} />
            ) : (
              <Crop
                size={tokens.iconSize.md}
                color={canCropSelectedPhoto ? tokens.colors.primary : tokens.colors.muted}
              />
            )
          }
          label={cropPending ? "Kırpılıyor" : "Kırp"}
          onPress={() => {
            if (!canCropSelectedPhoto) return;
            onCropSelectedPhoto(normalizedSelectedPhotoIndex, selectedPhotoUri);
          }}
        />
        <EventAlbumActionButton
          disabled={!selectedPhotoUri || actionsDisabled}
          icon={
            <Trash2
              size={tokens.iconSize.md}
              color={
                selectedPhotoUri && !actionsDisabled ? tokens.colors.primary : tokens.colors.muted
              }
            />
          }
          label="Sil"
          onPress={() =>
            Alert.alert("Medyayi sil", "Bu secili medyayi kaldirmak istiyor musun?", [
              { text: "Vazgec", style: "cancel" },
              {
                text: "Sil",
                style: "destructive",
                onPress: () => onRemoveSelectedPhoto(normalizedSelectedPhotoIndex),
              },
            ])
          }
        />
      </View>

      {previewMediaItems.length > 0 ? (
        <View
          style={{
            borderRadius: tokens.radius.lg,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.background,
            paddingHorizontal: 10,
            paddingVertical: 10,
          }}
        >
          <ScrollView
            horizontal
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {previewMediaItems.map((item, index) => (
              <EventAlbumDraggableThumb
                candidateUris={resolveMediaSelectionPreviewCandidates(item)}
                key={`${item.uri}-${index}`}
                kind={item.kind}
                uri={resolveMediaSelectionPreviewUri(item)}
                index={index}
                selected={index === normalizedSelectedPhotoIndex}
                disabled={actionsDisabled}
                onPress={() => handleThumbPress(index)}
                onLongPress={() => onLongPressPhoto(index)}
                swapSource={swapSourceIndex === index}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.tiny }}>
        {cropPending
          ? "Kırpma hazırlanıyor. İşlem bitene kadar seçimi kilitli tutuyoruz."
          : "Bir medyaya uzun basarak onu seç, sonra başka bir medyaya dokunarak yer değiştir."}
      </Text>

      <MediaViewerModal
        actions={viewerActions}
        initialIndex={normalizedSelectedPhotoIndex}
        items={viewerItems}
        onClose={() => setFullscreenVisible(false)}
        onIndexChange={(index) => {
          setViewerIndex(index);
          updateSelectedIndex(index, "viewer-index-change");
        }}
        visible={fullscreenVisible}
      />
    </>
  );
}
