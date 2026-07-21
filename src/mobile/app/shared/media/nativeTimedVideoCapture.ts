import * as ImagePicker from "expo-image-picker";
import { getInfoAsync } from "expo-file-system/legacy";
import { NativeModules, Platform } from "react-native";
import {
  filterSelectableMediaSelections,
  isSelectableVideoDuration,
  MAX_VIDEO_DURATION_SECONDS,
  requestVideoCapturePermissions,
  type MediaSelection,
} from "./mediaPicker";
import { buildVideoCaptureLimitMessage } from "./mediaVideoUtils";
import { openVideoCameraCapture } from "./videoCameraCaptureController";

type NativeTimedVideoCaptureModule = {
  capture: (maxDurationSeconds: number) => Promise<string>;
};

const nativeTimedVideoCapture = NativeModules.NativeTimedVideoCapture as
  NativeTimedVideoCaptureModule | undefined;
const CAPTURE_READY_TIMEOUT_MS = 15_000;
const CAPTURE_READY_POLL_MS = 140;

function isCaptureCancelled(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "").trim();
  const message = String((error as { message?: string } | null)?.message || "")
    .trim()
    .toLowerCase();
  return code === "E_PICKER_CANCELLED" || message.includes("cancel");
}

function inferFileName(uri: string) {
  const normalizedUri = String(uri || "").trim();
  const fileName = normalizedUri.split("/").pop() || "";
  return fileName || `video-${Date.now().toString(36)}.mp4`;
}

async function waitForReadyCapturedVideoUri(uri: string) {
  const normalizedUri = String(uri || "").trim();
  if (!normalizedUri || !normalizedUri.toLowerCase().startsWith("file://")) {
    return normalizedUri;
  }

  const deadline = Date.now() + CAPTURE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getInfoAsync(normalizedUri).catch(() => null);
    if (info?.exists && !info.isDirectory && Number(info.size || 0) > 0) {
      return normalizedUri;
    }
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_READY_POLL_MS));
  }

  throw new Error("Video dosyası hazırlanamadı. Lütfen tekrar dene.");
}

async function captureWithExpoPicker(maxDurationSeconds: number) {
  await requestVideoCapturePermissions();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["videos"],
    ...(Platform.OS === "ios"
      ? {
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN,
          videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
          videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        }
      : {}),
    quality: 0.85,
    videoMaxDuration: maxDurationSeconds,
  });
  if (result.canceled || !result.assets?.length) return null;
  const firstAsset = result.assets[0];
  if (
    firstAsset?.type === "video" &&
    !isSelectableVideoDuration(typeof firstAsset.duration === "number" ? firstAsset.duration : null)
  ) {
    throw new Error(buildVideoCaptureLimitMessage());
  }
  const selection = filterSelectableMediaSelections(result.assets, { allowVideo: true })[0] || null;
  if (selection?.kind === "video") {
    selection.uri = await waitForReadyCapturedVideoUri(selection.uri);
  }
  return selection;
}

async function captureWithInAppCamera(maxDurationSeconds: number) {
  await requestVideoCapturePermissions();
  const result = await openVideoCameraCapture({ maxDurationSeconds });
  if (!result?.uri) return null;

  const uri = await waitForReadyCapturedVideoUri(result.uri);
  if (!uri) return null;
  return {
    durationMs: result.durationMs || null,
    fileName: inferFileName(uri),
    kind: "video" as const,
    mimeType: "video/mp4",
    uri,
  };
}

export async function captureTimedVideoSelection(
  maxDurationSeconds = MAX_VIDEO_DURATION_SECONDS,
): Promise<MediaSelection | null> {
  try {
    return await captureWithInAppCamera(maxDurationSeconds);
  } catch {
    // in-app camera unavailable — fall back
  }

  if (Platform.OS !== "android" || !nativeTimedVideoCapture?.capture) {
    return captureWithExpoPicker(maxDurationSeconds);
  }

  try {
    await requestVideoCapturePermissions();
    const rawUri = String((await nativeTimedVideoCapture.capture(maxDurationSeconds)) || "").trim();
    const uri = await waitForReadyCapturedVideoUri(rawUri);
    if (!uri) return null;
    return {
      durationMs: null,
      fileName: inferFileName(uri),
      kind: "video",
      mimeType: "video/mp4",
      uri,
    };
  } catch (error) {
    if (isCaptureCancelled(error)) return null;
    throw error;
  }
}
