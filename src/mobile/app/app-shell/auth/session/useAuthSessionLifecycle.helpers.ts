import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { logError } from "../../../platform/observability";
import { logAuthSessionError } from "../../../platform/security/authSessionErrors";
import { supabase } from "../../../platform/supabase";
import type { AuthUserData } from "../../../data/contracts/entities";
import { getActiveOrPersistedSession } from "./authSessionSupport";
import {
  DEMO_DATA_KEY,
  DEMO_MODE_KEY,
  SESSION_REFRESH_TIMEOUT_MS,
  withTimeout,
} from "./authContext.shared";

type DemoAccountType = "student" | "club";

export const EMPTY_AUTH_USER_DATA: AuthUserData = {
  categories: [],
  coverImage: "",
  email: "",
  events: 0,
  followers: 0,
  following: 0,
  hideEmail: false,
  name: "",
  profileImage: "",
  university: "",
  username: "",
};

function encodeAccessToken(accessToken: string) {
  return Uint8Array.from(accessToken, (character) => character.charCodeAt(0));
}

export function buildSessionHydrationKey(session: Session) {
  const accessToken = String(session.access_token || "");
  const sessionFingerprint = accessToken
    ? bytesToHex(sha256(encodeAccessToken(accessToken)))
    : "session";
  return `${session.user.id}:${sessionFingerprint}`;
}

export async function persistDemoAuthState(type: DemoAccountType, data: AuthUserData) {
  await AsyncStorage.multiSet([
    [DEMO_MODE_KEY, type],
    [DEMO_DATA_KEY, JSON.stringify(data)],
  ]);
}

export function persistDemoAuthStateBestEffort(
  type: DemoAccountType,
  data: AuthUserData,
  source: string,
) {
  void persistDemoAuthState(type, data).catch((error) => {
    logError(error, {
      captureInSentry: false,
      meta: {
        operation: "persist-demo-state",
        scope: "auth-demo-mode",
        source,
      },
      name: "auth-session-non-blocking-error",
    });
  });
}

export async function refreshSessionWithTimeout() {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("refresh-timeout")),
          SESSION_REFRESH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function confirmPersistedSession() {
  try {
    return await withTimeout(getActiveOrPersistedSession(), 1500, "auth-session-confirm-timeout");
  } catch (error) {
    logAuthSessionError(error, {
      code: "auth-session-confirm-failed",
      fallbackMessage: "Persisted session confirmation failed.",
      operation: "confirm-persisted-session",
      recoverable: true,
      scope: "auth-session",
    });
    return null;
  }
}

export async function waitForPersistedSession(timeoutMs = 2500, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const session = await confirmPersistedSession();
    if (session) return session;
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(intervalMs, remainingMs));
    });
  }
  return null;
}
