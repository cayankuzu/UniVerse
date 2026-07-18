import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeUsername } from "./authHelpers";

const BLOCKED_USERS_CACHE_KEY_PREFIX = "ogrencisosyalagi:blocked-users-cache:v1";
export const BLOCKED_USERS_CACHE_TTL_MS = 5 * 60_000;

type BlockedUsersCachePayload = {
  updatedAt: number;
  usernames: string[];
};

function buildBlockedUsersCacheKey(viewerId: string) {
  return `${BLOCKED_USERS_CACHE_KEY_PREFIX}:${String(viewerId || "").trim()}`;
}

function normalizeBlockedUsernames(usernames: string[]) {
  return Array.from(
    new Set((usernames || []).map((item) => normalizeUsername(item)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "tr", { sensitivity: "base" }));
}

export async function readBlockedUsersCache(viewerId: string) {
  const normalizedViewerId = String(viewerId || "").trim();
  if (!normalizedViewerId) return null;

  const rawValue = await AsyncStorage.getItem(buildBlockedUsersCacheKey(normalizedViewerId)).catch(
    () => null,
  );
  if (!rawValue) return null;

  try {
    const payload = JSON.parse(rawValue) as Partial<BlockedUsersCachePayload> | null;
    const updatedAt = Number(payload?.updatedAt || 0);
    const usernames = Array.isArray(payload?.usernames)
      ? normalizeBlockedUsernames(payload?.usernames)
      : [];
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    return {
      updatedAt,
      usernames,
    };
  } catch {
    await AsyncStorage.removeItem(buildBlockedUsersCacheKey(normalizedViewerId)).catch(
      () => undefined,
    );
    return null;
  }
}

export async function writeBlockedUsersCache(viewerId: string, usernames: string[]) {
  const normalizedViewerId = String(viewerId || "").trim();
  if (!normalizedViewerId) return;

  const payload: BlockedUsersCachePayload = {
    updatedAt: Date.now(),
    usernames: normalizeBlockedUsernames(usernames),
  };
  await AsyncStorage.setItem(
    buildBlockedUsersCacheKey(normalizedViewerId),
    JSON.stringify(payload),
  ).catch(() => undefined);
}
