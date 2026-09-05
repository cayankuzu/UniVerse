import { SUPABASE_PROJECT_ID, SUPABASE_PUBLIC_ANON_KEY_FALLBACK } from "./supabasePublic";
import { APP_ENV, IS_PRODUCTION_RUNTIME, readStringEnv } from "./runtime";

type PublicAppEnvironment = "development" | "preview" | "production";
const SUPABASE_FUNCTION_PATH = "/functions/v1/server/make-server-e3557d40";

function canonicalEnvironmentComparisonValue(name: string, value: string) {
  const normalized = String(value || "").trim();
  if (!normalized || !name.endsWith("_URL")) return normalized;
  try {
    return new URL(normalized).origin.toLowerCase();
  } catch {
    return normalized.replace(/\/+$/, "").toLowerCase();
  }
}

function parsePublicUrl(name: string, value: string) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    throw new Error(`[public-env] Invalid URL for ${name}`);
  }
}

function isLocalDevelopmentOrigin(parsed: URL, appEnv: PublicAppEnvironment) {
  return (
    appEnv === "development" &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  );
}

function assertSecurePublicUrl(name: string, parsed: URL, appEnv: PublicAppEnvironment) {
  if (parsed.protocol !== "https:" && !isLocalDevelopmentOrigin(parsed, appEnv)) {
    throw new Error(`[public-env] ${name} must use https outside local development`);
  }
}

export function resolveEnvironmentScopedPublicValue(params: {
  appEnv: PublicAppEnvironment;
  explicitValue: string;
  fallback: string;
  forbiddenNonProductionValues?: readonly string[];
  name: string;
}) {
  const explicitValue = String(params.explicitValue || "").trim();
  const fallback = String(params.fallback || "").trim();
  if (params.appEnv !== "production") {
    if (!explicitValue) {
      throw new Error(
        `[public-env] Missing required ${params.appEnv} environment variable: ${params.name}`,
      );
    }
    const normalized = canonicalEnvironmentComparisonValue(params.name, explicitValue);
    const targetsProduction = (params.forbiddenNonProductionValues || []).some(
      (value) => canonicalEnvironmentComparisonValue(params.name, value) === normalized,
    );
    if (targetsProduction) {
      throw new Error(
        `[public-env] ${params.name} must target an isolated ${params.appEnv} environment`,
      );
    }
  }
  const value = explicitValue || fallback;
  if (value) return value;
  throw new Error(`[public-env] Missing required environment variable: ${params.name}`);
}

function readEnvironmentScopedPublicValue(
  name: string,
  fallback: string,
  forbiddenNonProductionValues: readonly string[] = [],
) {
  return resolveEnvironmentScopedPublicValue({
    appEnv: APP_ENV,
    explicitValue: readStringEnv(name),
    fallback,
    forbiddenNonProductionValues,
    name,
  });
}

export function validateSupabaseProjectUrl(
  name: string,
  value: string,
  appEnv: PublicAppEnvironment = APP_ENV,
  productionProjectRef = SUPABASE_PROJECT_ID,
) {
  const parsed = parsePublicUrl(name, value);
  assertSecurePublicUrl(name, parsed, appEnv);
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`[public-env] ${name} must be a project origin without path or credentials`);
  }

  if (
    appEnv === "preview" ||
    (appEnv === "development" && !isLocalDevelopmentOrigin(parsed, appEnv))
  ) {
    const match = /^([a-z0-9]{20})\.supabase\.co$/i.exec(parsed.hostname);
    if (!match || match[1].toLowerCase() === productionProjectRef.toLowerCase()) {
      throw new Error(`[public-env] ${name} must target an isolated ${appEnv} Supabase project`);
    }
  } else if (appEnv === "production") {
    const expectedOrigin = `https://${productionProjectRef.toLowerCase()}.supabase.co`;
    if (parsed.origin !== expectedOrigin) {
      throw new Error(
        `[public-env] ${name} must target the configured production Supabase project`,
      );
    }
  }
  return parsed.origin;
}

export function validateSupabaseFunctionsBaseUrl(
  name: string,
  value: string,
  expectedProjectOrigin: string,
  appEnv: PublicAppEnvironment = APP_ENV,
) {
  const parsed = parsePublicUrl(name, value);
  assertSecurePublicUrl(name, parsed, appEnv);
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    normalizedPath !== SUPABASE_FUNCTION_PATH
  ) {
    throw new Error(`[public-env] ${name} must use the expected Supabase Functions path`);
  }
  if (parsed.origin !== parsePublicUrl("EXPO_PUBLIC_SUPABASE_URL", expectedProjectOrigin).origin) {
    throw new Error(`[public-env] ${name} must target the configured Supabase project`);
  }
  return `${parsed.origin}${SUPABASE_FUNCTION_PATH}`;
}

export function validateOptionalGatewayUrl(
  name: string,
  value: string,
  isProductionRuntime = IS_PRODUCTION_RUNTIME,
  appEnv: PublicAppEnvironment = APP_ENV,
  forbiddenPreviewOrigins: readonly string[] = [],
) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";

  const parsed = parsePublicUrl(name, candidate);

  const isLocalDevelopmentUrl = !isProductionRuntime && isLocalDevelopmentOrigin(parsed, appEnv);
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

  if (appEnv === "preview") {
    const forbiddenOrigins = forbiddenPreviewOrigins
      .map((origin) => String(origin || "").trim())
      .filter(Boolean)
      .map((origin) => {
        const productionOrigin = parsePublicUrl(
          "EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL",
          origin,
        );
        assertSecurePublicUrl(
          "EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL",
          productionOrigin,
          "production",
        );
        if (
          productionOrigin.username ||
          productionOrigin.password ||
          productionOrigin.pathname !== "/" ||
          productionOrigin.search ||
          productionOrigin.hash
        ) {
          throw new Error(
            "[public-env] EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL must be an origin URL without path or credentials",
          );
        }
        return productionOrigin.origin;
      });
    if (forbiddenOrigins.length === 0) {
      throw new Error(
        "[public-env] Missing production Cloudflare gateway origin required for preview isolation",
      );
    }
    if (
      forbiddenOrigins.includes(parsed.origin) ||
      parsed.hostname.toLowerCase().includes("universe-edge-production")
    ) {
      throw new Error(`[public-env] ${name} must target an isolated preview gateway`);
    }
  } else if (appEnv === "production") {
    const declaredOrigins = forbiddenPreviewOrigins
      .map((origin) => String(origin || "").trim())
      .filter(Boolean)
      .map((origin) => {
        const productionOrigin = parsePublicUrl(
          "EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL",
          origin,
        );
        assertSecurePublicUrl(
          "EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL",
          productionOrigin,
          "production",
        );
        if (
          productionOrigin.username ||
          productionOrigin.password ||
          productionOrigin.pathname !== "/" ||
          productionOrigin.search ||
          productionOrigin.hash
        ) {
          throw new Error(
            "[public-env] EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL must be an origin URL without path or credentials",
          );
        }
        return productionOrigin.origin;
      });
    if (declaredOrigins.length === 0 || !declaredOrigins.includes(parsed.origin)) {
      throw new Error(`[public-env] ${name} must match the declared production gateway`);
    }
  }

  return parsed.origin;
}

const SUPABASE_PUBLIC_URL_FALLBACK = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLIC_URL_RAW = readEnvironmentScopedPublicValue(
  "EXPO_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLIC_URL_FALLBACK,
  [SUPABASE_PUBLIC_URL_FALLBACK],
);
export const SUPABASE_PUBLIC_URL = validateSupabaseProjectUrl(
  "EXPO_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLIC_URL_RAW,
);
export const SUPABASE_PUBLIC_URL_VALIDATED = SUPABASE_PUBLIC_URL;

export const SUPABASE_PUBLIC_ANON_KEY = readEnvironmentScopedPublicValue(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  SUPABASE_PUBLIC_ANON_KEY_FALLBACK,
  [SUPABASE_PUBLIC_ANON_KEY_FALLBACK],
);

const SUPABASE_FUNCTIONS_BASE_URL_FALLBACK = `${SUPABASE_PUBLIC_URL_VALIDATED}${SUPABASE_FUNCTION_PATH}`;
const PRODUCTION_SUPABASE_FUNCTIONS_BASE_URL = `${SUPABASE_PUBLIC_URL_FALLBACK}${SUPABASE_FUNCTION_PATH}`;
const SUPABASE_FUNCTIONS_BASE_URL_RAW = readEnvironmentScopedPublicValue(
  "EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL",
  SUPABASE_FUNCTIONS_BASE_URL_FALLBACK,
  [PRODUCTION_SUPABASE_FUNCTIONS_BASE_URL],
);
export const SUPABASE_FUNCTIONS_BASE_URL = validateSupabaseFunctionsBaseUrl(
  "EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL",
  SUPABASE_FUNCTIONS_BASE_URL_RAW,
  SUPABASE_PUBLIC_URL_VALIDATED,
);
export const SUPABASE_FUNCTIONS_BASE_URL_VALIDATED = SUPABASE_FUNCTIONS_BASE_URL;

/**
 * Optional, explicit cutover for the small route matrix handled by Cloudflare.
 * Empty keeps every request on the Supabase source-of-truth path for rollback.
 */
export const CLOUDFLARE_GATEWAY_URL = validateOptionalGatewayUrl(
  "EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL",
  readStringEnv("EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL", ""),
  IS_PRODUCTION_RUNTIME,
  APP_ENV,
  [readStringEnv("EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL", "")],
);
