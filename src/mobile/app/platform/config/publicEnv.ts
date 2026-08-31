import { SUPABASE_PROJECT_ID, SUPABASE_PUBLIC_ANON_KEY_FALLBACK } from "./supabasePublic";
import { IS_PRODUCTION_RUNTIME, readStringEnv } from "./runtime";

function readRequiredEnv(name: string, fallback = "") {
  const value = readStringEnv(name, fallback);
  if (value) return value;
  throw new Error(`[public-env] Missing required environment variable: ${name}`);
}

function readProductionAwareEnv(name: string, fallback = "") {
  return IS_PRODUCTION_RUNTIME ? readRequiredEnv(name, fallback) : readStringEnv(name, fallback);
}

function validatePublicUrl(name: string, value: string, fallback = "") {
  const normalized = String(value || "").trim();
  const fallbackNormalized = String(fallback || "").trim();
  const candidate = normalized || fallbackNormalized;
  if (!candidate) {
    throw new Error(`[public-env] Missing required environment variable: ${name}`);
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    if (!IS_PRODUCTION_RUNTIME && fallbackNormalized) {
      return fallbackNormalized.replace(/\/+$/, "");
    }
    throw new Error(`[public-env] Invalid URL for ${name}`);
  }
  if (IS_PRODUCTION_RUNTIME && parsed.protocol !== "https:") {
    throw new Error(`[public-env] ${name} must use https in production`);
  }
  return candidate.replace(/\/+$/, "");
}

export function validateOptionalGatewayUrl(
  name: string,
  value: string,
  isProductionRuntime = IS_PRODUCTION_RUNTIME,
) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`[public-env] Invalid URL for ${name}`);
  }

  const isLocalDevelopmentUrl =
    !isProductionRuntime &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalDevelopmentUrl) {
    throw new Error(`[public-env] ${name} must use https outside local development`);
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`[public-env] ${name} must be an origin URL without path or credentials`);
  }

  return candidate.replace(/\/+$/, "");
}

const SUPABASE_PUBLIC_URL_FALLBACK = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_PUBLIC_URL = readProductionAwareEnv(
  "EXPO_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLIC_URL_FALLBACK,
);
export const SUPABASE_PUBLIC_URL_VALIDATED = validatePublicUrl(
  "EXPO_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLIC_URL,
  SUPABASE_PUBLIC_URL_FALLBACK,
);

export const SUPABASE_PUBLIC_ANON_KEY = readProductionAwareEnv(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  SUPABASE_PUBLIC_ANON_KEY_FALLBACK,
);

const SUPABASE_FUNCTIONS_BASE_URL_FALLBACK = `${SUPABASE_PUBLIC_URL_VALIDATED}/functions/v1/server/make-server-e3557d40`;
export const SUPABASE_FUNCTIONS_BASE_URL = readProductionAwareEnv(
  "EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL",
  SUPABASE_FUNCTIONS_BASE_URL_FALLBACK,
);
export const SUPABASE_FUNCTIONS_BASE_URL_VALIDATED = validatePublicUrl(
  "EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL",
  SUPABASE_FUNCTIONS_BASE_URL,
  SUPABASE_FUNCTIONS_BASE_URL_FALLBACK,
);

/**
 * Optional, explicit cutover for the small route matrix handled by Cloudflare.
 * Empty keeps every request on the Supabase source-of-truth path for rollback.
 */
export const CLOUDFLARE_GATEWAY_URL = validateOptionalGatewayUrl(
  "EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL",
  readStringEnv("EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL", ""),
);
