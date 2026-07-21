import { Play } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import type { VideoThumbnail } from "expo-video";
import {
  canUseMediaUriDirectly,
  getCachedResolvedMediaUri,
  getMediaUriCacheKey,
  normalizeMediaUriInput,
  resolveMediaUri,
} from "./mediaUri";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";
import { getCachedVideoThumbnail, resolveVideoThumbnail } from "./videoThumbnailCache";
import { isImageMediaUri } from "./mediaVideoUtils";
import { tokens } from "../theme";

const VIDEO_THUMBNAIL_RESOLVE_RETRY_DELAYS_MS = [120, 320, 900, 1800];

type Props = {
  candidateUris?: Array<string | null | undefined>;
  contentFit?: "contain" | "cover";
  priority?: "deferred" | "eager";
  style?: StyleProp<ViewStyle>;
  uri: string;
};

type ThumbnailSource = VideoThumbnail | { cacheKey?: string; uri: string };

function buildPosterSource(candidate: string, resolvedUri: string): ThumbnailSource {
  return {
    cacheKey: getMediaUriCacheKey(candidate) || undefined,
    uri: resolvedUri,
  };
}

export function buildVideoThumbnailCandidateUris(
  primaryUri: string,
  candidateUris?: Array<string | null | undefined>,
) {
  const candidates: string[] = [];
  [...(candidateUris || []), primaryUri].forEach((value) => {
    const normalizedValue = normalizeMediaUriInput(value);
    if (!normalizedValue || candidates.includes(normalizedValue)) return;
    candidates.push(normalizedValue);
  });
  return candidates;
}

function getCachedThumbnailFromCandidates(candidates: string[]): ThumbnailSource | null {
  for (const candidate of candidates) {
    const cachedResolvedUri = canUseMediaUriDirectly(candidate)
      ? candidate
      : getCachedResolvedMediaUri(candidate);
    if (isImageMediaUri(candidate) && cachedResolvedUri) {
      return buildPosterSource(candidate, cachedResolvedUri);
    }
    const cachedThumbnail = getCachedVideoThumbnail(cachedResolvedUri || candidate);
    if (cachedThumbnail) {
      return cachedThumbnail;
    }
  }
  return null;
}

async function resolveThumbnailSourceUri(candidate: string, isCancelled: () => boolean) {
  if (canUseMediaUriDirectly(candidate)) {
    return candidate;
  }

  const cachedResolvedUri = getCachedResolvedMediaUri(candidate);
  if (cachedResolvedUri) {
    return cachedResolvedUri;
  }

  for (let attempt = 0; attempt <= VIDEO_THUMBNAIL_RESOLVE_RETRY_DELAYS_MS.length; attempt += 1) {
    const resolvedUri = await resolveMediaUri(candidate);
    if (resolvedUri || isCancelled()) {
      return resolvedUri;
    }
    const retryDelayMs = VIDEO_THUMBNAIL_RESOLVE_RETRY_DELAYS_MS[attempt];
    if (!retryDelayMs) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    if (isCancelled()) {
      return "";
    }
  }

  return "";
}

export function VideoThumbnailPreview({
  candidateUris,
  contentFit = "cover",
  priority = "eager",
  style,
  uri,
}: Props) {
  const candidatesKey = JSON.stringify(buildVideoThumbnailCandidateUris(uri, candidateUris));
  const thumbnailCandidates = useMemo(() => JSON.parse(candidatesKey) as string[], [candidatesKey]);
  const [thumbnail, setThumbnail] = useState<ThumbnailSource | null>(() =>
    getCachedThumbnailFromCandidates(thumbnailCandidates),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedThumbnail = getCachedThumbnailFromCandidates(thumbnailCandidates);
    setThumbnail(cachedThumbnail);
    setLoading(thumbnailCandidates.length > 0 && !cachedThumbnail);
  }, [candidatesKey, thumbnailCandidates]);

  useEffect(() => {
    if (thumbnailCandidates.length === 0) return undefined;
    let cancelled = false;
    const runThumbnailLoad = async () => {
      for (const candidate of thumbnailCandidates) {
        const resolvedSourceUri = await resolveThumbnailSourceUri(candidate, () => cancelled);
        if (!resolvedSourceUri) continue;
        const nextThumbnail = isImageMediaUri(candidate)
          ? buildPosterSource(candidate, resolvedSourceUri)
          : getCachedVideoThumbnail(resolvedSourceUri) ||
            (await resolveVideoThumbnail(resolvedSourceUri, { priority }));
        if (cancelled) return;
        if (!nextThumbnail) continue;
        setThumbnail(nextThumbnail);
        return;
      }
      if (!cancelled) {
        setThumbnail(null);
      }
    };

    const scheduleLoad = () => {
      void runThumbnailLoad().finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    };

    if (priority === "eager") {
      scheduleLoad();
      return () => {
        cancelled = true;
      };
    }

    const task = scheduleAfterInteractions(scheduleLoad, 72);

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [candidatesKey, priority, thumbnailCandidates]);

  const imageSource = useMemo(() => (thumbnail ? (thumbnail as never) : null), [thumbnail]);

  return (
    <View style={[{ backgroundColor: tokens.colors.foreground, overflow: "hidden" }, style]}>
      {imageSource ? (
        <ExpoImage
          cachePolicy="memory-disk"
          source={imageSource as never}
          style={{ width: "100%", height: "100%" }}
          contentFit={contentFit}
          priority={priority === "eager" ? "high" : "normal"}
          recyclingKey={candidatesKey}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {loading ? (
            <ActivityIndicator color={tokens.colors.onMedia} />
          ) : (
            <Play size={18} color={tokens.colors.onMedia} />
          )}
        </View>
      )}
    </View>
  );
}
