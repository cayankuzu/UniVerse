import { Clock3, Play } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import type { PickerMediaLibraryAsset } from "./mediaPicker";
import { formatMediaDuration } from "./mediaVideoUtils";
import { VideoThumbnailPreview } from "./VideoThumbnailPreview";

type Props = {
  asset: PickerMediaLibraryAsset;
  disabled: boolean;
  index: number;
  kind: "image" | "video";
  isLongVideo?: boolean;
  onPress: () => void;
  selectedNumber?: number;
  size: number;
};

export function MediaTile({
  asset,
  disabled,
  index,
  kind,
  isLongVideo = false,
  onPress,
  selectedNumber,
  size,
}: Props) {
  const [imagePhase, setImagePhase] = useState<"error" | "loaded" | "loading">(() =>
    kind === "image" ? "loading" : "loaded",
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
    if (kind !== "image") {
      setImagePhase("loaded");
      return;
    }
    setImagePhase(
      asset.previewCandidates.length > 0 || asset.previewUri || asset.runtimeUri
        ? "loading"
        : "error",
    );
  }, [asset, kind]);
  const imageUri =
    asset.previewCandidates[candidateIndex] || asset.previewUri || asset.runtimeUri || "";
  const durationLabel =
    kind === "video"
      ? formatMediaDuration(typeof asset.duration === "number" ? asset.duration * 1000 : null)
      : "";

  return (
    <Pressable
      accessibilityLabel={asset.filename || `${kind} ${index + 1}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: Boolean(selectedNumber) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radius.md,
        overflow: "hidden",
        backgroundColor: tokens.colors.border,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {kind === "image" ? (
        imagePhase === "error" || !imageUri ? null : (
          <>
            <ExpoImage
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }}
              cachePolicy="memory-disk"
              contentFit="cover"
              onLoad={() => {
                setImagePhase("loaded");
              }}
              onError={() => {
                const nextIndex = candidateIndex + 1;
                if (nextIndex < asset.previewCandidates.length) {
                  setCandidateIndex(nextIndex);
                  setImagePhase("loading");
                  return;
                }
                setImagePhase("error");
              }}
            />
            {imagePhase === "loading" ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(238,243,255,0.72)",
                }}
              >
                <ActivityIndicator color={tokens.colors.primary} />
              </View>
            ) : null}
          </>
        )
      ) : asset.thumbnailUri ? (
        <ExpoImage
          source={{ uri: asset.thumbnailUri }}
          style={{ width: "100%", height: "100%" }}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      ) : (
        <VideoThumbnailPreview
          candidateUris={asset.previewCandidates}
          priority="eager"
          style={{ width: "100%", height: "100%" }}
          uri={asset.runtimeUri || asset.uri || asset.previewCandidates[0] || ""}
        />
      )}
      {kind === "video" ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: tokens.colors.overlay,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: tokens.colors.overlay,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={16} color={tokens.colors.surface} />
          </View>
        </View>
      ) : null}
      <View
        style={{
          position: "absolute",
          left: tokens.spacing.xs,
          top: tokens.spacing.xs,
          borderRadius: 999,
          backgroundColor: tokens.colors.overlay,
          paddingHorizontal: tokens.spacing.xs,
          paddingVertical: tokens.spacing.xxs,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xxs,
        }}
      >
        <Text
          style={{
            color: tokens.colors.surface,
            fontSize: tokens.typography.tiny,
            fontWeight: "800",
          }}
        >
          {index + 1}
        </Text>
      </View>
      {kind === "video" ? (
        <View
          style={{
            position: "absolute",
            right: tokens.spacing.xs,
            bottom: tokens.spacing.xs,
            borderRadius: 999,
            backgroundColor: tokens.colors.overlay,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: tokens.spacing.xxs,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.xxs,
          }}
        >
          {isLongVideo ? <Clock3 size={12} color={tokens.colors.surface} /> : null}
          <Text
            style={{
              color: tokens.colors.surface,
              fontSize: tokens.typography.tiny,
              fontWeight: "800",
            }}
          >
            {isLongVideo
              ? durationLabel || t("media.library.videoLongLabel")
              : durationLabel || t("media.library.videoLabel")}
          </Text>
        </View>
      ) : null}
      {selectedNumber ? (
        <View
          style={{
            position: "absolute",
            right: tokens.spacing.xs,
            top: tokens.spacing.xs,
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: tokens.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: tokens.colors.surface, fontSize: 11, fontWeight: "800" }}>
            {selectedNumber}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
