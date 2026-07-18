import { NativeModules, Platform } from "react-native";

type NativeVideoNormalizerModule = {
  normalize: (
    sourceUri: string,
    baseName: string,
    maxDurationSeconds: number,
    targetLongEdgePx: number,
    targetShortEdgePx: number,
    videoBitrateBps: number,
    audioBitrateBps: number,
    maxBytes: number,
  ) => Promise<{
    durationMs?: number | null;
    height?: number | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    uri?: string | null;
    width?: number | null;
  }>;
};

const nativeVideoNormalizer = NativeModules.NativeVideoNormalizer as
  NativeVideoNormalizerModule | undefined;
const VIDEO_NORMALIZE_TIMEOUT_MS = 240_000;
let videoNormalizeQueue = Promise.resolve();

function withVideoNormalizeTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Video normalize timeout."));
    }, VIDEO_NORMALIZE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function normalizeVideoTo1080pUpload(params: {
  audioBitrateBps: number;
  baseName: string;
  maxBytes: number;
  maxDurationSeconds: number;
  sourceUri: string;
  targetLongEdgePx: number;
  targetShortEdgePx: number;
  videoBitrateBps: number;
}) {
  if (Platform.OS !== "android" || !nativeVideoNormalizer?.normalize) {
    return null;
  }

  const runNormalize = () =>
    withVideoNormalizeTimeout(
      nativeVideoNormalizer.normalize(
        params.sourceUri,
        params.baseName,
        params.maxDurationSeconds,
        params.targetLongEdgePx,
        params.targetShortEdgePx,
        params.videoBitrateBps,
        params.audioBitrateBps,
        params.maxBytes,
      ),
    );
  const queuedNormalize = videoNormalizeQueue.then(runNormalize, runNormalize);
  videoNormalizeQueue = queuedNormalize.then(
    () => undefined,
    () => undefined,
  );
  return queuedNormalize;
}
