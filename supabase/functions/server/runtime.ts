function normalizeEdgeAppEnv(value: string | undefined) {
  if (value === "development" || value === "preview" || value === "production") {
    return value;
  }
  return "production";
}

function envEnabled(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export type EdgeAppEnv = "development" | "preview" | "production";

export const EDGE_APP_ENV: EdgeAppEnv = normalizeEdgeAppEnv(
  Deno.env.get("EDGE_APP_ENV") || Deno.env.get("APP_ENV") || Deno.env.get("EXPO_PUBLIC_APP_ENV"),
);

export const IS_PRODUCTION_EDGE = EDGE_APP_ENV === "production";
export const IS_PREVIEW_EDGE = EDGE_APP_ENV === "preview";
export const IS_DEVELOPMENT_EDGE = EDGE_APP_ENV === "development";

export const COMPAT_ROUTES_ENABLED =
  !IS_PRODUCTION_EDGE && envEnabled(Deno.env.get("ENABLE_COMPAT_ROUTES"), true);

export const AUTH_RECOVERY_ENDPOINTS_ENABLED =
  !IS_PRODUCTION_EDGE && envEnabled(Deno.env.get("ENABLE_AUTH_RECOVERY_ENDPOINTS"), true);

export const TEST_AUTH_VERIFICATION_BYPASS_ENABLED =
  !IS_PRODUCTION_EDGE && envEnabled(Deno.env.get("ENABLE_TEST_AUTH_VERIFICATION_BYPASS"), false);

export const VERBOSE_EDGE_REQUEST_LOGS =
  !IS_PRODUCTION_EDGE && envEnabled(Deno.env.get("EDGE_VERBOSE_REQUEST_LOGS"), false);

export function readRequiredEdgeEnv(...names: string[]) {
  for (const name of names) {
    const value = String(Deno.env.get(name) || "").trim();
    if (value) return value;
  }
  throw new Error(`[edge-env] Missing required environment variable. Checked: ${names.join(", ")}`);
}
