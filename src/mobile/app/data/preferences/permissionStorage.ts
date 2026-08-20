import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PermissionSnapshot, PermissionStatus } from "./permission.types";

const PERMISSIONS_KEY = "UNiETAS_permissions";
const PERMISSION_PROMPT_PREFIX = "UNiETAS_permission_prompt_";

const DEFAULT_PERMISSION_SNAPSHOT: PermissionSnapshot = {
  camera: "undetermined",
  microphone: "undetermined",
  notifications: "undetermined",
  photos: "undetermined",
  completedAt: "",
};

function isPermissionStatus(value: unknown): value is PermissionStatus {
  return value === "granted" || value === "denied" || value === "undetermined";
}

function getPermissionPromptKey(userId: string) {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId ? `${PERMISSION_PROMPT_PREFIX}${normalizedUserId}` : "";
}

export function hasAnyPermissionGranted(snapshot: PermissionSnapshot): boolean {
  return (
    snapshot.camera === "granted" ||
    snapshot.microphone === "granted" ||
    snapshot.notifications === "granted" ||
    snapshot.photos === "granted"
  );
}

export function parsePermissionSnapshot(raw: string | null): PermissionSnapshot | null {
  if (!raw) return null;
  if (raw === "granted") {
    return {
      camera: "granted",
      microphone: "granted",
      notifications: "granted",
      photos: "granted",
      completedAt: new Date().toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PermissionSnapshot>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!isPermissionStatus(parsed.notifications) || !isPermissionStatus(parsed.photos)) {
      return null;
    }

    return {
      camera: isPermissionStatus(parsed.camera) ? parsed.camera : "undetermined",
      microphone: isPermissionStatus(parsed.microphone) ? parsed.microphone : "undetermined",
      notifications: parsed.notifications,
      photos: parsed.photos,
      completedAt: parsed.completedAt || new Date().toISOString(),
    } satisfies PermissionSnapshot;
  } catch {
    return null;
  }
}

export async function readPermissionSnapshot() {
  return parsePermissionSnapshot(await AsyncStorage.getItem(PERMISSIONS_KEY));
}

export async function persistPermissionSnapshot(snapshot?: PermissionSnapshot) {
  const value = snapshot
    ? { ...snapshot, completedAt: snapshot.completedAt || new Date().toISOString() }
    : { ...DEFAULT_PERMISSION_SNAPSHOT, completedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(value));
  return value;
}

export async function readPermissionPromptPreference(userId: string) {
  const key = getPermissionPromptKey(userId);
  if (!key.trim()) return false;
  return (await AsyncStorage.getItem(key)) === "hidden";
}

export async function persistPermissionPromptPreference(params: {
  suppressPrompt: boolean;
  userId: string;
}) {
  const key = getPermissionPromptKey(params.userId);
  if (!key.trim()) return;
  if (params.suppressPrompt) {
    await AsyncStorage.setItem(key, "hidden");
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function clearPermissionSnapshot() {
  await AsyncStorage.removeItem(PERMISSIONS_KEY);
}
