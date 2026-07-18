import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { logAuthSessionError } from "../security/authSessionErrors";

const SECURE_STORE_PREFIX = "supabase-auth";
export const SECURE_STORE_REGISTRY_KEY = "supabase-auth:secure-keys";
const CIRCUIT_BREAKER_RESET_MS = 30_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;

let secureStoreAvailabilityPromise: Promise<boolean> | null = null;
let consecutiveSecureStoreFailures = 0;
let circuitBreakerLogged = false;
let circuitOpenedAt = 0;

const inMemoryAuthCache = new Map<string, string>();
const blockedFallbackLogCache = new Map<string, number>();

export function allowInsecureFallback() {
  return Platform.OS === "web" || process.env.NODE_ENV === "test";
}

export async function clearLegacyAsyncValue(key: string) {
  await AsyncStorage.removeItem(key).catch(() => undefined);
}

export function rememberAuthValue(key: string, value: string | null | undefined) {
  if (value == null) {
    inMemoryAuthCache.delete(key);
    return;
  }
  inMemoryAuthCache.set(key, value);
}

export function readRememberedAuthValue(key: string) {
  return inMemoryAuthCache.get(key) ?? null;
}

export function clearRememberedAuthValues() {
  inMemoryAuthCache.clear();
}

export function resetCircuitBreaker() {
  consecutiveSecureStoreFailures = 0;
  circuitBreakerLogged = false;
  circuitOpenedAt = 0;
}

export function noteSecureStoreFailure() {
  consecutiveSecureStoreFailures += 1;
  if (consecutiveSecureStoreFailures >= CIRCUIT_BREAKER_THRESHOLD && circuitOpenedAt <= 0) {
    circuitOpenedAt = Date.now();
  }
}

export function shouldBypassSecureStore() {
  if (consecutiveSecureStoreFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (circuitOpenedAt > 0 && Date.now() - circuitOpenedAt >= CIRCUIT_BREAKER_RESET_MS) {
    resetCircuitBreaker();
    return false;
  }
  return true;
}

export function getCircuitBreakerFailureCount() {
  return consecutiveSecureStoreFailures;
}

export function shouldLogSecureStoreFallback() {
  if (circuitBreakerLogged) return false;
  circuitBreakerLogged = true;
  return true;
}

export function logInsecureFallbackBlocked(reason: string, key: string) {
  const cacheKey = `${key}:${reason}`;
  const now = Date.now();
  const lastLoggedAt = blockedFallbackLogCache.get(cacheKey) || 0;
  if (now - lastLoggedAt < CIRCUIT_BREAKER_RESET_MS) return;
  blockedFallbackLogCache.set(cacheKey, now);
  logAuthSessionError(new Error(reason), {
    code: "auth-storage-insecure-fallback-blocked",
    fallbackMessage: "Insecure auth storage fallback blocked on native runtime.",
    meta: { key, reason },
    operation: "auth-storage-fail-closed",
    recoverable: true,
    scope: "auth-storage",
  });
}

function encodeSecureStoreSegment(value: string) {
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

export function getSecureStoreKey(key: string) {
  const encodedKey = encodeSecureStoreSegment(key);
  return `${SECURE_STORE_PREFIX}.${encodedKey || "empty"}`;
}

export async function isSecureStoreAvailable() {
  if (Platform.OS === "web") return false;
  if (!secureStoreAvailabilityPromise) {
    secureStoreAvailabilityPromise = SecureStore.isAvailableAsync().catch((error) => {
      logAuthSessionError(error, {
        code: "auth-storage-secure-store-availability-failed",
        fallbackMessage: "SecureStore availability check failed.",
        operation: "secure-store-availability",
        recoverable: true,
        scope: "auth-storage",
      });
      return false;
    });
  }
  return secureStoreAvailabilityPromise;
}
