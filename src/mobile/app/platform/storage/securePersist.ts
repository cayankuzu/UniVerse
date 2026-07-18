import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SECURE_PERSIST_PREFIX = "app-secure";
const SECURE_PERSIST_CHUNK_SIZE = 1500;

type SecureMeta = {
  chunkCount: number;
};

function encodeKeySegment(value: string) {
  return String(value || "")
    .trim()
    .split("")
    .map((char) => {
      if (/^[A-Za-z0-9._-]$/.test(char)) return char;
      const codePoint = char.codePointAt(0);
      if (!codePoint) return "_x00_";
      return `_x${codePoint.toString(16)}_`;
    })
    .join("");
}

function buildSecureBaseKey(key: string) {
  return `${SECURE_PERSIST_PREFIX}.${encodeKeySegment(key) || "empty"}`;
}

function buildSecureMetaKey(key: string) {
  return `${buildSecureBaseKey(key)}.meta`;
}

function buildSecureChunkKey(key: string, index: number) {
  return `${buildSecureBaseKey(key)}.${index}`;
}

function chunkString(value: string) {
  const normalized = String(value ?? "");
  if (normalized.length === 0) return [""];

  const chunks: string[] = [];
  for (let cursor = 0; cursor < normalized.length; cursor += SECURE_PERSIST_CHUNK_SIZE) {
    chunks.push(normalized.slice(cursor, cursor + SECURE_PERSIST_CHUNK_SIZE));
  }
  return chunks;
}

async function canUseSecureStore() {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

function canUseInsecureDevelopmentStorage() {
  return Platform.OS === "web" || process.env.NODE_ENV === "test";
}

function createSecureStorageUnavailableError(key: string) {
  return new Error(`Secure storage unavailable for ${buildSecureBaseKey(key)}.`);
}

async function readSecureMeta(key: string): Promise<SecureMeta | null> {
  const raw = await SecureStore.getItemAsync(buildSecureMetaKey(key));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SecureMeta>;
    const chunkCount = Number(parsed.chunkCount || 0);
    if (!Number.isFinite(chunkCount) || chunkCount <= 0) return null;
    return { chunkCount };
  } catch {
    return null;
  }
}

async function removeSecureChunks(key: string, chunkCount: number) {
  await Promise.all(
    Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(buildSecureChunkKey(key, index)).catch(() => undefined),
    ),
  );
}

async function migrateLegacyAsyncValue(key: string) {
  const legacyValue = await AsyncStorage.getItem(key).catch(() => null);
  if (legacyValue == null) return null;
  await secureTextStorage.setItem(key, legacyValue);
  await AsyncStorage.removeItem(key).catch(() => undefined);
  return legacyValue;
}

export const secureTextStorage = {
  async getItem(key: string) {
    if (!(await canUseSecureStore())) {
      if (canUseInsecureDevelopmentStorage()) return AsyncStorage.getItem(key);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }

    const meta = await readSecureMeta(key);
    if (!meta) {
      return migrateLegacyAsyncValue(key);
    }

    const values = await Promise.all(
      Array.from({ length: meta.chunkCount }, (_, index) =>
        SecureStore.getItemAsync(buildSecureChunkKey(key, index)).catch(() => null),
      ),
    );
    if (values.some((value) => value == null)) {
      await secureTextStorage.removeItem(key);
      return null;
    }
    return values.join("");
  },

  async removeItem(key: string) {
    if (!(await canUseSecureStore())) {
      await AsyncStorage.removeItem(key);
      return;
    }

    const meta = await readSecureMeta(key);
    await SecureStore.deleteItemAsync(buildSecureMetaKey(key)).catch(() => undefined);
    if (meta?.chunkCount) {
      await removeSecureChunks(key, meta.chunkCount);
    }
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },

  async setItem(key: string, value: string) {
    if (!(await canUseSecureStore())) {
      if (canUseInsecureDevelopmentStorage()) {
        await AsyncStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.removeItem(key).catch(() => undefined);
      throw createSecureStorageUnavailableError(key);
    }

    const previousMeta = await readSecureMeta(key);
    const chunks = chunkString(value);

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(buildSecureChunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(
      buildSecureMetaKey(key),
      JSON.stringify({
        chunkCount: chunks.length,
      } satisfies SecureMeta),
    );
    if (previousMeta && previousMeta.chunkCount > chunks.length) {
      for (let index = chunks.length; index < previousMeta.chunkCount; index += 1) {
        await SecureStore.deleteItemAsync(buildSecureChunkKey(key, index)).catch(() => undefined);
      }
    }
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

export async function readSecureJson<T>(key: string): Promise<T | null> {
  const raw = await secureTextStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await secureTextStorage.removeItem(key);
    return null;
  }
}

export async function writeSecureJson(key: string, value: unknown) {
  await secureTextStorage.setItem(key, JSON.stringify(value));
}

export async function removeSecurePersistedValue(key: string) {
  await secureTextStorage.removeItem(key);
}
