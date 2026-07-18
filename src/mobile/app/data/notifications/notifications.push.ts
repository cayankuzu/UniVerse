import type { SuccessResponse } from "../contracts/api";
import { post } from "../../platform/api/core";
import {
  readSecureJson,
  removeSecurePersistedValue,
  writeSecureJson,
} from "../../platform/storage/securePersist";

export type PushPlatform = "android" | "ios";
export type PushAppEnv = "development" | "preview" | "production";

export type StoredPushRegistration = {
  appEnv: PushAppEnv;
  expoPushToken: string;
  platform: PushPlatform;
  userId: string;
};

type RegisterPushTokenPayload = {
  appEnv: PushAppEnv;
  expoPushToken: string;
  platform: PushPlatform;
};

const PUSH_REGISTRATION_STORAGE_KEY = "app:push-registration";

function normalizeStoredPushRegistration(value: unknown): StoredPushRegistration | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const expoPushToken = String(item.expoPushToken || "").trim();
  const userId = String(item.userId || "").trim();
  const platform = item.platform === "android" || item.platform === "ios" ? item.platform : null;
  const appEnv =
    item.appEnv === "development" || item.appEnv === "preview" || item.appEnv === "production"
      ? item.appEnv
      : null;
  if (!expoPushToken || !userId || !platform || !appEnv) return null;
  return {
    appEnv,
    expoPushToken,
    platform,
    userId,
  };
}

async function readStoredPushRegistration() {
  return normalizeStoredPushRegistration(
    await readSecureJson<StoredPushRegistration>(PUSH_REGISTRATION_STORAGE_KEY),
  );
}

async function writeStoredPushRegistration(value: StoredPushRegistration) {
  await writeSecureJson(PUSH_REGISTRATION_STORAGE_KEY, value);
}

async function clearStoredPushRegistration() {
  await removeSecurePersistedValue(PUSH_REGISTRATION_STORAGE_KEY);
}

export const NotificationPushAPI = {
  clearStoredRegistration: clearStoredPushRegistration,
  getStoredRegistration: readStoredPushRegistration,
  registerToken: (payload: RegisterPushTokenPayload) =>
    post<SuccessResponse>("/push/register", payload),
  rememberRegistration: writeStoredPushRegistration,
  unregisterToken: (expoPushToken: string) =>
    post<SuccessResponse>("/push/unregister", {
      expoPushToken,
    }),
};

export async function bestEffortUnregisterStoredPushToken() {
  const stored = await readStoredPushRegistration();
  if (!stored?.expoPushToken) {
    await clearStoredPushRegistration();
    return;
  }
  try {
    await NotificationPushAPI.unregisterToken(stored.expoPushToken);
  } catch {
    // Logout should continue even if token cleanup fails.
  } finally {
    await clearStoredPushRegistration();
  }
}
