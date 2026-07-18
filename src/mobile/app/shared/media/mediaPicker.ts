import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Alert, PermissionsAndroid, Platform, type AlertButton } from "react-native";
import {
  isSelectableVideoDuration,
  isVideoMediaUri as isVideoMediaAssetUri,
  resolveMediaUploadFileInfo,
} from "./mediaVideoUtils";

export { isSelectableVideoDuration, MAX_VIDEO_DURATION_SECONDS } from "./mediaVideoUtils";

export type MediaSelectionKind = "image" | "video";

export type MediaSelection = {
  durationMs?: number | null;
  fileName?: string | null;
  kind: MediaSelectionKind;
  mimeType?: string | null;
  previewCandidates?: string[];
  previewUri?: string | null;
  uri: string;
};

type MediaLibraryAssetWithLocalUri = MediaLibrary.Asset & {
  localUri?: string | null;
};

export type PickerMediaLibraryAsset = MediaLibrary.Asset & {
  previewCandidates: string[];
  previewUri?: string | null;
  runtimeUri?: string | null;
  thumbnailUri?: string | null;
};

export const MAX_ALBUM_MEDIA_ITEMS = 9;

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function isContentUri(uri: string) {
  return normalizeText(uri).toLowerCase().startsWith("content://");
}

function collectPreviewCandidate(candidates: string[], value: unknown) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return;
  if (candidates.includes(normalizedValue)) return;
  candidates.push(normalizedValue);
}

export function isVideoMediaUri(uri: string) {
  return isVideoMediaAssetUri(uri);
}

export function getVideoPosterUri(uri: string) {
  const normalized = normalizeText(uri);
  return /^file:|^content:|^asset:/i.test(normalized) ? normalized : "";
}

export function resolveMediaSelectionKind(asset: ImagePicker.ImagePickerAsset): MediaSelectionKind {
  const mimeType = normalizeText(asset.mimeType).toLowerCase();
  const fileName = normalizeText(asset.fileName).toLowerCase();
  if (asset.type === "video" || mimeType.startsWith("video/") || isVideoMediaUri(fileName)) {
    return "video";
  }
  return "image";
}

export function mapMediaSelection(asset: ImagePicker.ImagePickerAsset): MediaSelection {
  const normalizedUri = normalizeText(asset.uri);
  return {
    durationMs: typeof asset.duration === "number" ? asset.duration : null,
    fileName: asset.fileName || null,
    kind: resolveMediaSelectionKind(asset),
    mimeType: asset.mimeType || null,
    previewCandidates: normalizedUri ? [normalizedUri] : [],
    previewUri: normalizedUri,
    uri: normalizedUri,
  };
}

function resolveLibraryAssetKind(asset: MediaLibrary.Asset): MediaSelectionKind {
  const mediaType = String(asset.mediaType || "").toLowerCase();
  const fileName = normalizeText(asset.filename).toLowerCase();
  return mediaType === "video" || isVideoMediaUri(fileName) ? "video" : "image";
}

function resolveAndroidLibraryPreviewUri(asset: MediaLibrary.Asset) {
  if (Platform.OS !== "android") return "";

  const assetId = normalizeText(asset.id);
  if (!/^\d+$/.test(assetId)) {
    const assetWithLocalUri = asset as MediaLibraryAssetWithLocalUri;
    const localUri = normalizeText(assetWithLocalUri.localUri);
    const assetUri = normalizeText(asset.uri);
    if (isContentUri(localUri)) return localUri;
    if (isContentUri(assetUri)) return assetUri;
    return "";
  }

  const mediaType = String(asset.mediaType || "").toLowerCase();
  if (mediaType === "video") {
    return `content://media/external/video/media/${assetId}`;
  }
  return `content://media/external/images/media/${assetId}`;
}

export function resolveLibraryAssetRuntimeUri(asset: MediaLibrary.Asset) {
  const assetWithLocalUri = asset as MediaLibraryAssetWithLocalUri;
  const assetUri = normalizeText(asset.uri);
  const localUri = normalizeText(assetWithLocalUri.localUri);
  const androidMediaStoreUri = resolveAndroidLibraryPreviewUri(asset);

  if (Platform.OS === "android") {
    if (isContentUri(localUri)) return localUri;
    if (isContentUri(assetUri)) return assetUri;
    if (androidMediaStoreUri) return androidMediaStoreUri;
    return assetUri || localUri;
  }

  return localUri || assetUri;
}

export function resolveLibraryAssetPreviewUri(asset: MediaLibrary.Asset) {
  const androidPreviewUri = resolveAndroidLibraryPreviewUri(asset);
  if (Platform.OS === "android") {
    return androidPreviewUri;
  }
  return androidPreviewUri || resolveLibraryAssetRuntimeUri(asset);
}

function hasAccessibleAndroidLibraryUri(asset: MediaLibrary.Asset) {
  if (Platform.OS !== "android") return false;
  const runtimeUri = normalizeText(resolveLibraryAssetRuntimeUri(asset));
  const previewUri = normalizeText(resolveLibraryAssetPreviewUri(asset));
  return isContentUri(runtimeUri) || isContentUri(previewUri);
}

export function getLibraryAssetPreviewCandidates(asset: MediaLibrary.Asset) {
  const assetWithLocalUri = asset as MediaLibraryAssetWithLocalUri;
  const candidates: string[] = [];
  if (Platform.OS === "ios" && resolveLibraryAssetKind(asset) === "video") {
    collectPreviewCandidate(candidates, asset.uri);
    collectPreviewCandidate(candidates, assetWithLocalUri.localUri);
    collectPreviewCandidate(candidates, resolveLibraryAssetRuntimeUri(asset));
    return candidates;
  }

  collectPreviewCandidate(candidates, resolveAndroidLibraryPreviewUri(asset));
  collectPreviewCandidate(candidates, assetWithLocalUri.localUri);
  collectPreviewCandidate(candidates, asset.uri);
  collectPreviewCandidate(candidates, resolveLibraryAssetRuntimeUri(asset));
  return candidates;
}

function mapPickerLibraryAsset(asset: MediaLibrary.Asset): PickerMediaLibraryAsset {
  const previewCandidates = getLibraryAssetPreviewCandidates(asset);
  return {
    ...asset,
    previewCandidates,
    previewUri: previewCandidates[0] || resolveLibraryAssetPreviewUri(asset),
    runtimeUri: resolveLibraryAssetRuntimeUri(asset),
  };
}

export function resolveMediaSelectionPreviewCandidates(
  selection?: Pick<MediaSelection, "previewCandidates" | "previewUri" | "uri"> | null,
) {
  const candidates: string[] = [];
  selection?.previewCandidates?.forEach((value) => {
    collectPreviewCandidate(candidates, value);
  });
  collectPreviewCandidate(candidates, selection?.previewUri);
  collectPreviewCandidate(candidates, selection?.uri);
  return candidates;
}

export function resolveMediaSelectionPreviewUri(
  selection?: Pick<MediaSelection, "previewCandidates" | "previewUri" | "uri"> | null,
) {
  return resolveMediaSelectionPreviewCandidates(selection)[0] || "";
}

export function mapLibraryAssetSelection(asset: MediaLibrary.Asset): MediaSelection {
  const kind = resolveLibraryAssetKind(asset);
  const previewCandidates = getLibraryAssetPreviewCandidates(asset);
  return {
    durationMs: typeof asset.duration === "number" ? asset.duration * 1000 : null,
    fileName: asset.filename || null,
    kind,
    mimeType: asset.mediaType ? `${asset.mediaType}/${kind}` : null,
    previewCandidates,
    previewUri: previewCandidates[0] || resolveLibraryAssetPreviewUri(asset),
    uri: resolveLibraryAssetRuntimeUri(asset),
  };
}

export async function mapResolvedLibraryAssetSelection(asset: MediaLibrary.Asset) {
  if (Platform.OS !== "android") {
    return mapLibraryAssetSelection(asset);
  }

  if (hasAccessibleAndroidLibraryUri(asset)) {
    return mapLibraryAssetSelection(asset);
  }

  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset, {
      shouldDownloadFromNetwork: false,
    });
    const resolvedAsset = {
      ...asset,
      ...info,
      localUri: info.localUri || null,
    } as MediaLibraryAssetWithLocalUri;
    return mapLibraryAssetSelection(resolvedAsset);
  } catch {
    return mapLibraryAssetSelection(asset);
  }
}

export async function hydrateLibraryAssetForPicker(asset: MediaLibrary.Asset) {
  if (Platform.OS === "android") {
    return mapPickerLibraryAsset(asset);
  }

  const shouldResolveAssetInfo = !(asset as MediaLibraryAssetWithLocalUri).localUri;

  if (!shouldResolveAssetInfo) {
    return mapPickerLibraryAsset(asset);
  }

  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset, {
      shouldDownloadFromNetwork: false,
    });
    return mapPickerLibraryAsset({
      ...asset,
      ...info,
      localUri: info.localUri || null,
    } as MediaLibraryAssetWithLocalUri);
  } catch {
    return mapPickerLibraryAsset(asset);
  }
}

export function filterSelectableMediaSelections(
  assets: ImagePicker.ImagePickerAsset[],
  params?: { allowVideo?: boolean },
) {
  const allowVideo = params?.allowVideo !== false;
  return assets.map(mapMediaSelection).filter((item) => {
    if (item.kind !== "video") return true;
    return allowVideo && isSelectableVideoDuration(item.durationMs);
  });
}

export async function captureCameraImageSelection(params?: { quality?: number }) {
  await requestCameraPermission();

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    mediaTypes: ["images"],
    ...(Platform.OS === "ios"
      ? {
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN,
        }
      : {}),
    quality: params?.quality ?? 0.85,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return filterSelectableMediaSelections(result.assets, { allowVideo: false })[0] || null;
}

export async function requestLibraryPermission() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Galeri izni gerekli.");
  }
}

export async function requestCameraPermission() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Kamera izni gerekli.");
  }
}

export async function requestMicrophonePermission() {
  if (Platform.OS !== "android") {
    return;
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Videoları sesli kaydetmek için mikrofon izni gerekli.");
  }
}

export async function requestVideoCapturePermissions() {
  await requestCameraPermission();
  await requestMicrophonePermission();
}

export type MediaSourceAction = "camera-photo" | "camera-video" | "library" | "cancel";

export const MEDIA_PICKER_TRANSITION_DELAY_MS = 80;
export const MEDIA_PICKER_TRANSITION_DELAY_MS_IOS = 220;

export async function waitForMediaPickerTransition(ms = getMediaPickerTransitionDelayMs()) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getMediaPickerTransitionDelayMs() {
  return Platform.OS === "ios"
    ? MEDIA_PICKER_TRANSITION_DELAY_MS_IOS
    : MEDIA_PICKER_TRANSITION_DELAY_MS;
}

export function resolveSelectionUploadFileInfo(
  selection: Pick<MediaSelection, "kind" | "uri">,
  baseName?: string,
) {
  return resolveMediaUploadFileInfo(selection.uri, {
    baseName,
    kind: selection.kind,
  });
}

export function chooseMediaSourceAction(params: {
  allowVideo: boolean;
  title?: string;
}): Promise<MediaSourceAction> {
  return new Promise((resolve) => {
    const buttons: AlertButton[] = [
      { text: "Fotoğraf çek", onPress: () => resolve("camera-photo" as const) },
    ];
    if (params.allowVideo) {
      buttons.push({ text: "Video çek", onPress: () => resolve("camera-video" as const) });
    }
    buttons.push({ text: "Medya ekle", onPress: () => resolve("library" as const) });
    buttons.push({
      style: "cancel" as const,
      text: "İptal",
      onPress: () => resolve("cancel" as const),
    });

    Alert.alert(params.title || "Medya ekle", "Kaynak seç", buttons);
  });
}
