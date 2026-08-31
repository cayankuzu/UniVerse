function normalizeBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

type AppEnv = "development" | "preview" | "production";
const APP_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/i;

// Expo only inlines EXPO_PUBLIC_* values referenced through static dot notation.
// Keep this allowlist explicit; dynamic process.env[name] access is not bundle-safe.
const STATIC_PUBLIC_ENV = {
  EXPO_PUBLIC_ALLOW_DIRECT_STORAGE_UPLOAD_FALLBACK:
    process.env.EXPO_PUBLIC_ALLOW_DIRECT_STORAGE_UPLOAD_FALLBACK,
  EXPO_PUBLIC_ALLOW_HOME_CLIENT_FALLBACK: process.env.EXPO_PUBLIC_ALLOW_HOME_CLIENT_FALLBACK,
  EXPO_PUBLIC_APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
  EXPO_PUBLIC_BYPASS_AUTH_VERIFICATION_FOR_TESTING:
    process.env.EXPO_PUBLIC_BYPASS_AUTH_VERIFICATION_FOR_TESTING,
  EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL: process.env.EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL,
  EXPO_PUBLIC_DEBUG_SCROLL: process.env.EXPO_PUBLIC_DEBUG_SCROLL,
  EXPO_PUBLIC_DEBUG_SCROLL_VERBOSE: process.env.EXPO_PUBLIC_DEBUG_SCROLL_VERBOSE,
  EXPO_PUBLIC_DEBUG_VERBOSE: process.env.EXPO_PUBLIC_DEBUG_VERBOSE,
  EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS: process.env.EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS,
  EXPO_PUBLIC_ENABLE_DEMO_MODE: process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL: process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_USE_OPTIMISTIC_CREATE_EVENT: process.env.EXPO_PUBLIC_USE_OPTIMISTIC_CREATE_EVENT,
  EXPO_PUBLIC_USE_OPTIMISTIC_PROFILE_UPDATE: process.env.EXPO_PUBLIC_USE_OPTIMISTIC_PROFILE_UPDATE,
  EXPO_PUBLIC_USE_PROJECTION_ALBUM: process.env.EXPO_PUBLIC_USE_PROJECTION_ALBUM,
  EXPO_PUBLIC_USE_PROJECTION_EVENT_DETAIL: process.env.EXPO_PUBLIC_USE_PROJECTION_EVENT_DETAIL,
  EXPO_PUBLIC_USE_PROJECTION_SEARCH: process.env.EXPO_PUBLIC_USE_PROJECTION_SEARCH,
} as const;

function normalizeAppEnv(value: string | undefined): AppEnv {
  if (value === "preview" || value === "production") return value;
  return "development";
}

export const APP_ENV = normalizeAppEnv(process.env.EXPO_PUBLIC_APP_ENV);
export const IS_TEST_RUNTIME = process.env.NODE_ENV === "test";

export function readStringEnv(name: string, fallback = "") {
  const raw = STATIC_PUBLIC_ENV[name as keyof typeof STATIC_PUBLIC_ENV];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  return String(fallback).trim();
}

export function readBooleanEnv(name: string, fallback: boolean) {
  return normalizeBooleanEnv(readStringEnv(name), fallback);
}

export const APP_SCHEME =
  readStringEnv("EXPO_PUBLIC_APP_SCHEME", "ogrencisosyalagi") || "ogrencisosyalagi";
if (!APP_SCHEME_PATTERN.test(APP_SCHEME)) {
  throw new Error("[runtime-config] Invalid EXPO_PUBLIC_APP_SCHEME");
}
export const IS_DEVELOPMENT_RUNTIME = APP_ENV === "development";
export const IS_PRODUCTION_RUNTIME = APP_ENV === "production";
export const DEMO_MODE_ENABLED =
  IS_DEVELOPMENT_RUNTIME && readBooleanEnv("EXPO_PUBLIC_ENABLE_DEMO_MODE", false);
export const AUTH_VERIFICATION_BYPASS_ENABLED =
  !IS_PRODUCTION_RUNTIME &&
  readBooleanEnv("EXPO_PUBLIC_BYPASS_AUTH_VERIFICATION_FOR_TESTING", false);

export const RUNTIME_FLAGS = {
  allowHomeClientFallback: readBooleanEnv("EXPO_PUBLIC_ALLOW_HOME_CLIENT_FALLBACK", false),
  allowDirectStorageUploadFallback:
    !IS_PRODUCTION_RUNTIME &&
    readBooleanEnv("EXPO_PUBLIC_ALLOW_DIRECT_STORAGE_UPLOAD_FALLBACK", false),
  disableLegacyEdgeReads: readBooleanEnv("EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS", true),
  useOptimisticCreateEvent: readBooleanEnv("EXPO_PUBLIC_USE_OPTIMISTIC_CREATE_EVENT", true),
  useOptimisticProfileUpdate: readBooleanEnv("EXPO_PUBLIC_USE_OPTIMISTIC_PROFILE_UPDATE", true),
  useProjectionAlbum: readBooleanEnv("EXPO_PUBLIC_USE_PROJECTION_ALBUM", true),
  useProjectionEventDetail: readBooleanEnv("EXPO_PUBLIC_USE_PROJECTION_EVENT_DETAIL", true),
  useProjectionSearch: readBooleanEnv("EXPO_PUBLIC_USE_PROJECTION_SEARCH", true),
} as const;
