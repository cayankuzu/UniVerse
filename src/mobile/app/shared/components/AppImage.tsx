import { memo, useMemo, useState } from "react";
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../theme";
import { canUseMediaUriDirectly, getMediaUriCacheKey } from "../media/mediaUri";
import { useResolvedMediaUri } from "../media/useResolvedMediaUri";

export type AppImageVariant = "thumbnail" | "medium" | "full";

type AppImageVariants = Partial<Record<AppImageVariant, string | null>>;

type Props = Omit<ExpoImageProps, "source" | "style" | "priority"> & {
  fallbackUri?: string | null;
  /** When true, image loads with high priority (above-the-fold content). */
  highPriority?: boolean;
  placeholderColor?: string;
  showPlaceholderWhenEmpty?: boolean;
  style?: StyleProp<ImageStyle>;
  transitionMs?: number;
  uri?: string | null;
  variant?: AppImageVariant;
  variants?: AppImageVariants | null;
  wrapperStyle?: StyleProp<ViewStyle>;
};

function resolvePrimaryImageUri(params: {
  fallbackUri?: string | null;
  uri?: string | null;
  variant: AppImageVariant;
  variants?: AppImageVariants | null;
}) {
  const orderedVariants: AppImageVariant[] =
    params.variant === "thumbnail"
      ? ["thumbnail", "medium", "full"]
      : params.variant === "medium"
        ? ["medium", "full", "thumbnail"]
        : ["full", "medium", "thumbnail"];
  const candidateUris = [
    ...orderedVariants.map((key) => String(params.variants?.[key] || "").trim()),
    String(params.uri || "").trim(),
    String(params.fallbackUri || "").trim(),
  ];
  return candidateUris.find(Boolean) || null;
}

function resolvePreviewImageUri(params: {
  variant: AppImageVariant;
  variants?: AppImageVariants | null;
}) {
  if (params.variant === "thumbnail") return null;
  if (params.variant === "medium") {
    return String(params.variants?.thumbnail || "").trim() || null;
  }
  return (
    String(params.variants?.thumbnail || "").trim() ||
    String(params.variants?.medium || "").trim() ||
    null
  );
}

/**
 * Instagram-style image component with:
 * - Instant display from cache (zero transition when cached)
 * - Cross-session disk caching via stable cacheKey (storage path)
 * - Progressive loading: placeholder → thumbnail → full image
 * - Priority loading for above-fold images
 * - Memory-disk caching for instant re-display
 */
export const AppImage = memo(function AppImage({
  allowDownscaling = true,
  cachePolicy = "memory-disk",
  contentFit = "cover",
  fallbackUri,
  highPriority = false,
  placeholderColor = tokens.colors.border,
  showPlaceholderWhenEmpty = false,
  style,
  transitionMs = 50,
  uri,
  variant = "full",
  variants,
  wrapperStyle,
  ...props
}: Props) {
  const resolvedUri = useMemo(
    () =>
      resolvePrimaryImageUri({
        fallbackUri,
        uri,
        variant,
        variants,
      }),
    [fallbackUri, uri, variant, variants],
  );
  const shouldRetryPrimaryResolution = Boolean(resolvedUri && !canUseMediaUriDirectly(resolvedUri));
  const signedResolvedUri = useResolvedMediaUri(resolvedUri, {
    priority: highPriority ? "eager" : "deferred",
    retry: shouldRetryPrimaryResolution,
  });
  // Instagram pattern: use the raw storage path as a stable cacheKey.
  // Signed URLs change every session, but the storage path is immutable.
  // ExpoImage looks up cacheKey first → cross-session disk cache hits → instant display.
  const stableCacheKey = getMediaUriCacheKey(resolvedUri) || resolvedUri || undefined;
  const previewCandidateUri = useMemo(
    () =>
      resolvePreviewImageUri({
        variant,
        variants,
      }),
    [variant, variants],
  );
  const shouldRetryPreviewResolution = Boolean(
    previewCandidateUri && !canUseMediaUriDirectly(previewCandidateUri),
  );
  const previewResolvedUri = useResolvedMediaUri(previewCandidateUri, {
    priority: highPriority ? "eager" : "deferred",
    retry: shouldRetryPreviewResolution,
  });
  const previewCacheKey =
    getMediaUriCacheKey(previewCandidateUri || previewResolvedUri) ||
    previewCandidateUri ||
    previewResolvedUri ||
    undefined;
  const [isLoaded, setIsLoaded] = useState(false);
  const flattenedStyle = StyleSheet.flatten(style);
  const hasImageCandidate = Boolean(resolvedUri || previewCandidateUri);
  const showPreviewLayer = Boolean(
    previewResolvedUri &&
    previewResolvedUri !== signedResolvedUri &&
    (!isLoaded || !signedResolvedUri),
  );
  const showPlaceholder = Boolean(
    (showPlaceholderWhenEmpty || hasImageCandidate) &&
    (!isLoaded || !signedResolvedUri) &&
    !showPreviewLayer,
  );

  const isLocalSource = /^(?:asset|content|file|ph):/i.test(String(signedResolvedUri || ""));
  const effectiveTransition = isLocalSource ? 0 : transitionMs;
  const previewSource = useMemo(
    () =>
      previewResolvedUri
        ? {
            cacheKey: previewCacheKey,
            uri: previewResolvedUri,
          }
        : null,
    [previewCacheKey, previewResolvedUri],
  );
  const imageSource = useMemo(
    () =>
      signedResolvedUri
        ? {
            cacheKey: stableCacheKey,
            uri: signedResolvedUri,
          }
        : null,
    [signedResolvedUri, stableCacheKey],
  );
  const containerStyle = useMemo(
    () => [flattenedStyle, styles.container, wrapperStyle],
    [flattenedStyle, wrapperStyle],
  );
  const placeholderStyle = useMemo(
    () => [styles.placeholder, { backgroundColor: placeholderColor }],
    [placeholderColor],
  );

  if (!hasImageCandidate && !showPlaceholderWhenEmpty) return null;

  return (
    <View style={containerStyle}>
      {showPlaceholder ? <View pointerEvents="none" style={placeholderStyle} /> : null}
      {showPreviewLayer && previewSource ? (
        <ExpoImage
          allowDownscaling
          cachePolicy={cachePolicy}
          contentFit={contentFit}
          pointerEvents="none"
          source={previewSource}
          style={styles.image}
          transition={0}
        />
      ) : null}
      {imageSource ? (
        <ExpoImage
          {...props}
          allowDownscaling={allowDownscaling}
          cachePolicy={cachePolicy}
          contentFit={contentFit}
          onError={(event) => {
            setIsLoaded(false);
            props.onError?.(event);
          }}
          onLoad={(event) => {
            setIsLoaded(true);
            props.onLoad?.(event);
          }}
          onLoadStart={() => {
            setIsLoaded(false);
            props.onLoadStart?.();
          }}
          priority={highPriority ? "high" : "normal"}
          recyclingKey={stableCacheKey || signedResolvedUri}
          source={imageSource}
          style={styles.image}
          transition={effectiveTransition}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
});
