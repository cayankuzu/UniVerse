import * as SecureStore from "expo-secure-store";
import type { Session } from "@supabase/supabase-js";
import type { AccountType } from "../../data/contracts/api";
import type { AuthUserData } from "../../data/contracts/entities";
import { readSecureJson, removeSecurePersistedValue, writeSecureJson } from "./securePersist";

type RestorableAuthSession = {
  access_token: string;
  refresh_token: string;
};

export type PersistedAuthSnapshot = {
  accountType: AccountType;
  isPrivateAccount: boolean;
  userData: AuthUserData;
};

type PersistedAuthPayload = RestorableAuthSession & {
  snapshot?: PersistedAuthSnapshot | null;
};

const AUTH_SESSION_STORAGE_KEY = "universe.auth.session:v1";
let persistedAuthPayloadCache: PersistedAuthPayload | null | undefined;
let persistedAuthPayloadReadPromise: Promise<PersistedAuthPayload | null> | null = null;
let persistedAuthPayloadGeneration = 0;

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || undefined;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];
}

function normalizeNumber(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function normalizeAuthUserData(value: unknown): AuthUserData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const username = normalizeString(record.username).toLowerCase();
  const email = normalizeString(record.email).toLowerCase();
  const university = normalizeString(record.university);

  if (!username || !email || !university) {
    return null;
  }

  return {
    albums: normalizeNumber(record.albums),
    bio: normalizeOptionalString(record.bio),
    categories: normalizeStringArray(record.categories),
    clubName: normalizeOptionalString(record.clubName),
    coverImage: normalizeString(record.coverImage),
    coverImageVariants:
      record.coverImageVariants && typeof record.coverImageVariants === "object"
        ? (record.coverImageVariants as AuthUserData["coverImageVariants"])
        : undefined,
    department: normalizeOptionalString(record.department),
    description: normalizeOptionalString(record.description),
    email,
    events: normalizeNumber(record.events),
    followers: normalizeNumber(record.followers),
    following: normalizeNumber(record.following),
    gradeYear: normalizeOptionalString(record.gradeYear),
    hideEmail: typeof record.hideEmail === "boolean" ? record.hideEmail : undefined,
    id: normalizeOptionalString(record.id),
    isPrivate: typeof record.isPrivate === "boolean" ? record.isPrivate : undefined,
    name: normalizeOptionalString(record.name),
    profileImage: normalizeString(record.profileImage),
    profileImageVariants:
      record.profileImageVariants && typeof record.profileImageVariants === "object"
        ? (record.profileImageVariants as AuthUserData["profileImageVariants"])
        : undefined,
    university,
    username,
  };
}

function normalizePersistedAuthSnapshot(value: unknown): PersistedAuthSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const userData = normalizeAuthUserData(record.userData);
  if (!userData) {
    return null;
  }

  return {
    accountType: record.accountType === "club" ? "club" : "student",
    isPrivateAccount: Boolean(record.isPrivateAccount),
    userData,
  };
}

function normalizePersistedAuthPayload(value: unknown): PersistedAuthPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const accessToken = normalizeString(record.access_token);
  const refreshToken = normalizeString(record.refresh_token);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    snapshot: normalizePersistedAuthSnapshot(record.snapshot),
  };
}

async function removeLegacyDirectSecureStoreValue() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY).catch(() => undefined);
}

async function migrateLegacyDirectSecureStorePayload() {
  const rawLegacyValue = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY).catch(() => null);
  if (!rawLegacyValue) {
    return null;
  }

  try {
    const normalizedPayload = normalizePersistedAuthPayload(JSON.parse(rawLegacyValue) as unknown);
    if (!normalizedPayload) {
      await removeLegacyDirectSecureStoreValue();
      return null;
    }

    await writeSecureJson(AUTH_SESSION_STORAGE_KEY, normalizedPayload);
    await removeLegacyDirectSecureStoreValue();
    return normalizedPayload;
  } catch {
    await removeLegacyDirectSecureStoreValue();
    return null;
  }
}

async function readPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  if (persistedAuthPayloadCache !== undefined) {
    return persistedAuthPayloadCache;
  }
  if (persistedAuthPayloadReadPromise) {
    return persistedAuthPayloadReadPromise;
  }

  const readGeneration = persistedAuthPayloadGeneration;
  const readPromise = (async () => {
    const persistedValue = await readSecureJson<unknown>(AUTH_SESSION_STORAGE_KEY);
    let payload: PersistedAuthPayload | null = null;
    if (persistedValue != null) {
      payload = normalizePersistedAuthPayload(persistedValue);
      if (!payload) {
        await clearPersistedAuthSession();
      }
    }

    if (!payload) {
      payload = await migrateLegacyDirectSecureStorePayload();
    }
    if (readGeneration !== persistedAuthPayloadGeneration) {
      return null;
    }
    persistedAuthPayloadCache = payload;
    return payload;
  })();

  persistedAuthPayloadReadPromise = readPromise;
  try {
    return await readPromise;
  } finally {
    if (persistedAuthPayloadReadPromise === readPromise) {
      persistedAuthPayloadReadPromise = null;
    }
  }
}

export async function savePersistedAuthSession(session: Session | null) {
  if (!session?.access_token || !session.refresh_token) {
    await clearPersistedAuthSession();
    return;
  }

  const existingPayload = await readPersistedAuthPayload();
  const payload: PersistedAuthPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    snapshot: existingPayload?.snapshot ?? null,
  };

  await writeSecureJson(AUTH_SESSION_STORAGE_KEY, payload);
  persistedAuthPayloadGeneration += 1;
  persistedAuthPayloadCache = payload;
}

export async function getPersistedAuthSession(): Promise<RestorableAuthSession | null> {
  const payload = await readPersistedAuthPayload();
  if (!payload) {
    return null;
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  };
}

export async function savePersistedAuthSnapshot(snapshot: PersistedAuthSnapshot | null) {
  const payload = await readPersistedAuthPayload();
  if (!payload) {
    return;
  }

  const nextPayload = {
    ...payload,
    snapshot,
  } satisfies PersistedAuthPayload;
  await writeSecureJson(AUTH_SESSION_STORAGE_KEY, nextPayload);
  persistedAuthPayloadGeneration += 1;
  persistedAuthPayloadCache = nextPayload;
}

export async function getPersistedAuthSnapshot() {
  const payload = await readPersistedAuthPayload();
  return payload?.snapshot ?? null;
}

export async function clearPersistedAuthSession() {
  persistedAuthPayloadGeneration += 1;
  persistedAuthPayloadCache = null;
  await Promise.all([
    removeSecurePersistedValue(AUTH_SESSION_STORAGE_KEY),
    removeLegacyDirectSecureStoreValue(),
  ]);
}
