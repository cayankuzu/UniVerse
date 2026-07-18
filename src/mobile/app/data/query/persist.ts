import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";
import {
  removeSecurePersistedValue,
  secureTextStorage,
} from "../../platform/storage/securePersist";

const LEGACY_QUERY_CACHE_PERSIST_KEYS = ["ogrencisosyalagi:query-cache"] as const;

export const QUERY_CACHE_PERSIST_KEY = "ogrencisosyalagi:query-cache:v2";
export const QUERY_CACHE_BUSTER = "startup-2026-07-18-v4";
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
export const QUERY_CACHE_MAX_BYTES = 512 * 1024;
const QUERY_CACHE_PERSIST_THROTTLE_MS = 350;
const SENSITIVE_PERSISTED_FIELD_PATTERN =
  /(^|_)(access.?token|refresh.?token|authorization|birth.?date|email|password|phone|secret)($|_)/i;
const RELATION_SNAPSHOT_QUERY_DOMAINS = new Set(["discovery", "social"]);
const PERSISTED_SCREEN_QUERY_DOMAINS = new Set([
  "album-event",
  "blocked-users",
  "event-detail",
  "home",
  "notifications",
  "profile-content",
  "profile-overview",
  "profile-screen",
  "relationships",
  "search",
]);
let pendingPersistClientRaw = "";
let lastPersistedClientRaw = "";
let persistClientTimer: ReturnType<typeof setTimeout> | null = null;
let persistClientFlushPromise: Promise<void> | null = null;
let resolvePersistClientFlush: (() => void) | null = null;
let rejectPersistClientFlush: ((error: unknown) => void) | null = null;

function stringifyPersistedClient(client: PersistedClient) {
  return JSON.stringify(client, (key, value) =>
    SENSITIVE_PERSISTED_FIELD_PATTERN.test(key) ? undefined : value,
  );
}

function parseAndSanitizePersistedClient(raw: string) {
  let removedSensitiveField = false;
  const client = JSON.parse(raw, (key, value) => {
    if (SENSITIVE_PERSISTED_FIELD_PATTERN.test(key)) {
      removedSensitiveField = true;
      return undefined;
    }
    return value;
  }) as PersistedClient;

  return {
    client,
    sanitizedRaw: removedSensitiveField ? JSON.stringify(client) : raw,
  };
}

async function removePersistedQueryCacheStorage(key: string) {
  await Promise.all([
    AsyncStorage.removeItem(key).catch(() => undefined),
    removeSecurePersistedValue(key),
  ]);
}

async function readPersistedQueryCacheRaw(key: string) {
  const asyncStoredValue = await AsyncStorage.getItem(key).catch(() => null);
  if (asyncStoredValue) return asyncStoredValue;

  const legacySecureValue = await secureTextStorage.getItem(key).catch(() => null);
  if (!legacySecureValue) return null;
  let sanitizedLegacyValue: string | null = null;
  try {
    sanitizedLegacyValue = parseAndSanitizePersistedClient(legacySecureValue).sanitizedRaw;
  } catch {
    sanitizedLegacyValue = null;
  }
  if (sanitizedLegacyValue && sanitizedLegacyValue.length <= QUERY_CACHE_MAX_BYTES) {
    await AsyncStorage.setItem(key, sanitizedLegacyValue);
  }
  await removeSecurePersistedValue(key);
  return sanitizedLegacyValue && sanitizedLegacyValue.length <= QUERY_CACHE_MAX_BYTES
    ? sanitizedLegacyValue
    : null;
}

function readQueryKeyParts(query: Query) {
  const queryKey = Array.isArray(query.queryKey) ? query.queryKey : [];
  return {
    first: String(queryKey[0] || ""),
    second: String(queryKey[1] || ""),
    third: String(queryKey[2] || ""),
  };
}

export function shouldPersistQuery(query: Query) {
  if (query.state.status !== "success") return false;

  const { first, second, third } = readQueryKeyParts(query);

  if (first === "badge") return true;
  if (first === "profile" && second === "me") return true;
  if (first === "screen" && PERSISTED_SCREEN_QUERY_DOMAINS.has(second)) return true;
  if (
    RELATION_SNAPSHOT_QUERY_DOMAINS.has(first) &&
    second === "relations" &&
    third === "snapshot"
  ) {
    return true;
  }
  return false;
}

async function parsePersistedClient(raw: string | null): Promise<PersistedClient | undefined> {
  if (!raw) return undefined;
  if (raw.length > QUERY_CACHE_MAX_BYTES) {
    await removePersistedQueryCacheStorage(QUERY_CACHE_PERSIST_KEY);
    return undefined;
  }
  try {
    const { client, sanitizedRaw } = parseAndSanitizePersistedClient(raw);
    if (sanitizedRaw !== raw) {
      await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, sanitizedRaw);
    }
    lastPersistedClientRaw = sanitizedRaw;
    return client;
  } catch {
    await removePersistedQueryCacheStorage(QUERY_CACHE_PERSIST_KEY);
    return undefined;
  }
}

function clearPendingPersistClientTimer() {
  if (persistClientTimer) {
    clearTimeout(persistClientTimer);
    persistClientTimer = null;
  }
}

function settlePendingPersistClientFlush(error?: unknown) {
  if (error) rejectPersistClientFlush?.(error);
  else resolvePersistClientFlush?.();
  resolvePersistClientFlush = null;
  rejectPersistClientFlush = null;
  persistClientFlushPromise = null;
}

async function flushPersistedClient() {
  const raw = pendingPersistClientRaw;
  clearPendingPersistClientTimer();
  if (!raw || raw === lastPersistedClientRaw) {
    settlePendingPersistClientFlush();
    return;
  }
  if (raw.length > QUERY_CACHE_MAX_BYTES) {
    pendingPersistClientRaw = "";
    lastPersistedClientRaw = "";
    await removePersistedQueryCacheStorage(QUERY_CACHE_PERSIST_KEY);
    settlePendingPersistClientFlush();
    return;
  }
  await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, raw);
  await removeSecurePersistedValue(QUERY_CACHE_PERSIST_KEY);
  lastPersistedClientRaw = raw;
  settlePendingPersistClientFlush();
}

export const queryCachePersister: Persister = {
  persistClient: async (client) => {
    pendingPersistClientRaw = stringifyPersistedClient(client);
    if (!persistClientFlushPromise) {
      persistClientFlushPromise = new Promise<void>((resolve, reject) => {
        resolvePersistClientFlush = resolve;
        rejectPersistClientFlush = reject;
      });
    }
    if (!persistClientTimer) {
      persistClientTimer = setTimeout(() => {
        void flushPersistedClient().catch(settlePendingPersistClientFlush);
      }, QUERY_CACHE_PERSIST_THROTTLE_MS);
    }
    await persistClientFlushPromise;
  },
  removeClient: async () => {
    pendingPersistClientRaw = "";
    lastPersistedClientRaw = "";
    clearPendingPersistClientTimer();
    settlePendingPersistClientFlush();
    await removePersistedQueryCacheStorage(QUERY_CACHE_PERSIST_KEY);
  },
  restoreClient: async () =>
    parsePersistedClient(await readPersistedQueryCacheRaw(QUERY_CACHE_PERSIST_KEY)),
};

export async function clearPersistedQueryCache() {
  await Promise.all(
    [QUERY_CACHE_PERSIST_KEY, ...LEGACY_QUERY_CACHE_PERSIST_KEYS].map((key) =>
      removePersistedQueryCacheStorage(key),
    ),
  );
}
