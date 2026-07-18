import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { logAuthSessionError } from "../security/authSessionErrors";
import {
  allowInsecureFallback,
  clearLegacyAsyncValue,
  clearRememberedAuthValues,
  getCircuitBreakerFailureCount,
  getSecureStoreKey,
  isSecureStoreAvailable,
  logInsecureFallbackBlocked,
  noteSecureStoreFailure,
  readRememberedAuthValue,
  rememberAuthValue,
  resetCircuitBreaker,
  SECURE_STORE_REGISTRY_KEY,
  shouldBypassSecureStore,
  shouldLogSecureStoreFallback,
} from "./authStorage.shared";

async function readTrackedKeys() {
  try {
    const raw = await AsyncStorage.getItem(SECURE_STORE_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  } catch (error) {
    logAuthSessionError(error, {
      code: "auth-storage-registry-read-failed",
      fallbackMessage: "Auth storage registry read failed.",
      operation: "read-tracked-keys",
      recoverable: true,
      scope: "auth-storage",
    });
    return [];
  }
}

async function writeTrackedKeys(keys: string[]) {
  const nextKeys = Array.from(
    new Set(keys.map((item) => String(item || "").trim()).filter(Boolean)),
  );
  if (nextKeys.length === 0) {
    await AsyncStorage.removeItem(SECURE_STORE_REGISTRY_KEY);
    return;
  }
  await AsyncStorage.setItem(SECURE_STORE_REGISTRY_KEY, JSON.stringify(nextKeys));
}

async function trackSecureKey(key: string) {
  const trackedKeys = await readTrackedKeys();
  if (trackedKeys.includes(key)) return;
  await writeTrackedKeys([...trackedKeys, key]);
}

async function untrackSecureKey(key: string) {
  const trackedKeys = await readTrackedKeys();
  if (!trackedKeys.includes(key)) return;
  await writeTrackedKeys(trackedKeys.filter((item) => item !== key));
}

async function readLegacyValue(key: string) {
  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue == null) return null;
  rememberAuthValue(key, legacyValue);

  try {
    await SecureStore.setItemAsync(getSecureStoreKey(key), legacyValue);
    await trackSecureKey(key);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    logAuthSessionError(error, {
      code: "auth-storage-migration-failed",
      fallbackMessage: "Auth storage migration failed.",
      meta: { key },
      operation: "secure-store-migration",
      recoverable: true,
      scope: "auth-storage",
    });
  }

  return legacyValue;
}

async function getSecureValue(key: string) {
  if (!(await isSecureStoreAvailable())) {
    if (allowInsecureFallback()) {
      const value = await AsyncStorage.getItem(key);
      rememberAuthValue(key, value);
      return value;
    }
    const remembered = readRememberedAuthValue(key);
    if (remembered != null) return remembered;
    logInsecureFallbackBlocked("secure-store-unavailable", key);
    await clearLegacyAsyncValue(key);
    return null;
  }

  if (shouldBypassSecureStore()) {
    const remembered = readRememberedAuthValue(key);
    if (remembered != null) return remembered;
    if (allowInsecureFallback()) {
      const value = await AsyncStorage.getItem(key);
      rememberAuthValue(key, value);
      return value;
    }
    logInsecureFallbackBlocked("secure-store-circuit-open", key);
    await clearLegacyAsyncValue(key);
    return null;
  }

  try {
    const secureValue = await SecureStore.getItemAsync(getSecureStoreKey(key));
    if (secureValue != null) {
      resetCircuitBreaker();
      rememberAuthValue(key, secureValue);
      return secureValue;
    }
  } catch (error) {
    noteSecureStoreFailure();
    if (shouldLogSecureStoreFallback()) {
      logAuthSessionError(error, {
        code: "auth-storage-read-fallback",
        fallbackMessage: "SecureStore read failed.",
        meta: { failures: getCircuitBreakerFailureCount(), key },
        operation: "secure-store-read",
        recoverable: true,
        scope: "auth-storage",
      });
    }
    const remembered = readRememberedAuthValue(key);
    if (remembered != null) return remembered;
    if (allowInsecureFallback()) {
      const value = await AsyncStorage.getItem(key);
      rememberAuthValue(key, value);
      return value;
    }
    logInsecureFallbackBlocked("secure-store-read-failed", key);
    await clearLegacyAsyncValue(key);
    return null;
  }

  return readLegacyValue(key);
}

async function setSecureValue(key: string, value: string) {
  rememberAuthValue(key, value);
  if (!(await isSecureStoreAvailable())) {
    if (allowInsecureFallback()) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    logInsecureFallbackBlocked("secure-store-unavailable-write", key);
    await clearLegacyAsyncValue(key);
    return;
  }

  if (shouldBypassSecureStore()) {
    if (allowInsecureFallback()) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    logInsecureFallbackBlocked("secure-store-circuit-open-write", key);
    await clearLegacyAsyncValue(key);
    return;
  }

  try {
    await SecureStore.setItemAsync(getSecureStoreKey(key), value);
    resetCircuitBreaker();
    await trackSecureKey(key);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    noteSecureStoreFailure();
    if (shouldLogSecureStoreFallback()) {
      logAuthSessionError(error, {
        code: "auth-storage-write-fallback",
        fallbackMessage: "SecureStore write failed.",
        meta: { failures: getCircuitBreakerFailureCount(), key },
        operation: "secure-store-write",
        recoverable: true,
        scope: "auth-storage",
      });
    }
    if (allowInsecureFallback()) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    logInsecureFallbackBlocked("secure-store-write-failed", key);
    await clearLegacyAsyncValue(key);
  }
}

async function removeSecureValue(key: string) {
  rememberAuthValue(key, null);
  if (!(await isSecureStoreAvailable())) {
    await AsyncStorage.removeItem(key);
    return;
  }

  if (shouldBypassSecureStore()) {
    await AsyncStorage.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(getSecureStoreKey(key));
    resetCircuitBreaker();
    await untrackSecureKey(key);
  } catch (error) {
    noteSecureStoreFailure();
    if (shouldLogSecureStoreFallback()) {
      logAuthSessionError(error, {
        code: "auth-storage-delete-fallback",
        fallbackMessage: "SecureStore delete failed.",
        meta: { failures: getCircuitBreakerFailureCount(), key },
        operation: "secure-store-delete",
        recoverable: true,
        scope: "auth-storage",
      });
    }
  }
  await AsyncStorage.removeItem(key);
}

export async function clearTrackedSecureKeys() {
  clearRememberedAuthValues();
  if (!(await isSecureStoreAvailable())) {
    await AsyncStorage.removeItem(SECURE_STORE_REGISTRY_KEY);
    return;
  }

  const trackedKeys = await readTrackedKeys();
  await Promise.all(
    trackedKeys.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(getSecureStoreKey(key));
      } catch (error) {
        logAuthSessionError(error, {
          code: "auth-storage-clear-key-failed",
          fallbackMessage: "SecureStore clear failed.",
          meta: { key },
          operation: "secure-store-clear",
          recoverable: true,
          scope: "auth-storage",
        });
      }
    }),
  );
  await AsyncStorage.removeItem(SECURE_STORE_REGISTRY_KEY);
}

export const supabaseAuthStorage = {
  getItem: (key: string) => getSecureValue(key),
  removeItem: (key: string) => removeSecureValue(key),
  setItem: (key: string, value: string) => setSecureValue(key, value),
};
