import type { PermissionSnapshot, PermissionStatus } from "./permission.types";
import { resolvePushPlatform } from "../notifications/pushRuntime";
import {
  hasNotificationPermission,
  requestNotificationPermissionFromUserInteraction,
} from "../notifications/notificationPermission";

export type DevicePermissionKey = "notifications" | "photos" | "camera" | "microphone";
export type DevicePermissionState = Record<DevicePermissionKey, PermissionStatus>;

const DEFAULT_DEVICE_PERMISSION_STATE: DevicePermissionState = {
  camera: "undetermined",
  microphone: "undetermined",
  notifications: "undetermined",
  photos: "undetermined",
};
const DEVICE_PERMISSION_KEYS: DevicePermissionKey[] = [
  "notifications",
  "photos",
  "camera",
  "microphone",
];

export const DEVICE_PERMISSION_DETAILS: Array<{
  description: string;
  id: DevicePermissionKey;
  label: string;
}> = [
  {
    description: "Hatırlatmalar, duyurular ve kritik güncellemeler için.",
    id: "notifications",
    label: "Bildirimler",
  },
  {
    description: "Galeriden fotoğraf seçmek ve albüm oluşturmak için.",
    id: "photos",
    label: "Fotoğraflar ve Medya",
  },
  {
    description: "Fotoğraf ve video çekip doğrudan yükleyebilmek için.",
    id: "camera",
    label: "Kamera",
  },
  {
    description: "Çekilen videolarda ses kaydı almak için.",
    id: "microphone",
    label: "Mikrofon",
  },
];

function normalizePermissionStatus(value: unknown): PermissionStatus {
  return value === "granted" || value === "denied" || value === "undetermined"
    ? value
    : "undetermined";
}

type NotificationsModule = typeof import("expo-notifications");
type CameraModule = typeof import("expo-camera");
type MediaLibraryModule = typeof import("expo-media-library");
type NotificationPermissionsStatus = Awaited<
  ReturnType<NotificationsModule["getPermissionsAsync"]>
>;

let cameraModulePromise: Promise<CameraModule> | null = null;
let mediaLibraryModulePromise: Promise<MediaLibraryModule> | null = null;
let notificationsModulePromise: Promise<NotificationsModule> | null = null;

function loadCameraModule() {
  cameraModulePromise ??= Promise.resolve().then(() => require("expo-camera") as CameraModule);
  return cameraModulePromise;
}

function loadMediaLibraryModule() {
  mediaLibraryModulePromise ??= Promise.resolve().then(
    () => require("expo-media-library") as MediaLibraryModule,
  );
  return mediaLibraryModulePromise;
}

function loadNotificationsModule() {
  notificationsModulePromise ??= Promise.resolve().then(
    () => require("expo-notifications") as NotificationsModule,
  );
  return notificationsModulePromise;
}

function normalizeNotificationStatus(status: NotificationPermissionsStatus): PermissionStatus {
  if (hasNotificationPermission(status)) {
    return "granted";
  }
  return normalizePermissionStatus((status as { status?: unknown }).status);
}

async function readMicrophonePermissionState(): Promise<PermissionStatus> {
  const Camera = await loadCameraModule();
  const result = await Camera.Camera.getMicrophonePermissionsAsync();
  return normalizePermissionStatus(result.status);
}

async function requestMicrophonePermission(): Promise<PermissionStatus> {
  const Camera = await loadCameraModule();
  const result = await Camera.Camera.requestMicrophonePermissionsAsync();
  return normalizePermissionStatus(result.status);
}

async function readPermissionStatus(permission: DevicePermissionKey): Promise<PermissionStatus> {
  if (permission === "notifications") {
    if (!resolvePushPlatform()) {
      return "denied";
    }
    const Notifications = await loadNotificationsModule();
    const result = await Notifications.getPermissionsAsync();
    return normalizeNotificationStatus(result);
  }
  if (permission === "photos") {
    const MediaLibrary = await loadMediaLibraryModule();
    const result = await MediaLibrary.getPermissionsAsync();
    return normalizePermissionStatus(result.status);
  }
  if (permission === "camera") {
    const Camera = await loadCameraModule();
    const result = await Camera.Camera.getCameraPermissionsAsync();
    return normalizePermissionStatus(result.status);
  }
  return readMicrophonePermissionState();
}

export async function readDevicePermissionStateProgressively(
  onUpdate?: (state: DevicePermissionState, permission: DevicePermissionKey) => void,
): Promise<DevicePermissionState> {
  const nextState: DevicePermissionState = { ...DEFAULT_DEVICE_PERMISSION_STATE };

  for (const permission of DEVICE_PERMISSION_KEYS) {
    nextState[permission] = await readPermissionStatus(permission).catch(() => "undetermined");
    onUpdate?.({ ...nextState }, permission);
  }

  return nextState;
}

export async function readDevicePermissionState(): Promise<DevicePermissionState> {
  return readDevicePermissionStateProgressively();
}

export async function requestDevicePermission(
  permission: DevicePermissionKey,
): Promise<PermissionStatus> {
  if (permission === "notifications") {
    if (!resolvePushPlatform()) {
      return "denied";
    }
    return (await requestNotificationPermissionFromUserInteraction()) ? "granted" : "denied";
  }
  if (permission === "camera") {
    const Camera = await loadCameraModule();
    const result = await Camera.Camera.requestCameraPermissionsAsync();
    return normalizePermissionStatus(result.status);
  }
  if (permission === "microphone") {
    return requestMicrophonePermission();
  }
  const MediaLibrary = await loadMediaLibraryModule();
  const result = await MediaLibrary.requestPermissionsAsync();
  return normalizePermissionStatus(result.status);
}

export function devicePermissionStateFromSnapshot(
  snapshot?: PermissionSnapshot | null,
): DevicePermissionState {
  if (!snapshot) {
    return DEFAULT_DEVICE_PERMISSION_STATE;
  }

  return {
    camera: normalizePermissionStatus(snapshot.camera),
    microphone: normalizePermissionStatus(snapshot.microphone),
    notifications: normalizePermissionStatus(snapshot.notifications),
    photos: normalizePermissionStatus(snapshot.photos),
  };
}

export function toPermissionSnapshot(state: DevicePermissionState): PermissionSnapshot {
  return {
    camera: state.camera,
    completedAt: new Date().toISOString(),
    microphone: state.microphone,
    notifications: state.notifications,
    photos: state.photos,
  };
}
