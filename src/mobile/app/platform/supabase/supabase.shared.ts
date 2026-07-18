export type SupabaseDeepLinkTarget = "AuthCallback" | "ResetPassword" | null;

type ParsedSupabaseUrl = {
  path?: string | null;
  queryParams?: Record<string, unknown> | null;
  scheme?: string | null;
};

export interface ParsedSupabaseDeepLink {
  accessToken?: string;
  code?: string;
  flow?: string;
  hadAuthPayload: boolean;
  normalizedUrl: string;
  refreshToken?: string;
  state?: string;
  target: SupabaseDeepLinkTarget;
  trustedDeepLink: boolean;
}

function readStringParam(queryParams: Record<string, unknown>, key: string) {
  return typeof queryParams[key] === "string" ? String(queryParams[key]) : undefined;
}

export function resolveSupabaseDeepLinkTarget(path: string) {
  const normalizedPath = String(path || "")
    .trim()
    .replace(/^\/+/, "");
  if (normalizedPath === "auth/callback") return "AuthCallback";
  if (normalizedPath === "reset-password") return "ResetPassword";
  return null;
}

export function isTrustedAuthDeepLink(params: {
  appScheme: string;
  parsed: ParsedSupabaseUrl;
  url: string;
}) {
  const normalizedUrl = String(params.url || "")
    .trim()
    .toLowerCase();
  const normalizedScheme = params.appScheme.toLowerCase();
  return (
    normalizedUrl.startsWith(`${normalizedScheme}://`) &&
    String(params.parsed.scheme || "")
      .trim()
      .toLowerCase() === normalizedScheme
  );
}

export function parseSupabaseDeepLink(params: {
  appScheme: string;
  parseUrl: (url: string) => ParsedSupabaseUrl;
  url: string;
}): ParsedSupabaseDeepLink {
  const normalizedUrl = String(params.url || "").replace("#", "?");
  const parsed = params.parseUrl(normalizedUrl);
  const queryParams = parsed.queryParams ?? {};
  const code = readStringParam(queryParams, "code");
  const accessToken = readStringParam(queryParams, "access_token");
  const refreshToken = readStringParam(queryParams, "refresh_token");
  const flow = readStringParam(queryParams, "flow");
  const state = readStringParam(queryParams, "state");

  return {
    accessToken,
    code,
    flow,
    hadAuthPayload: Boolean(code || (accessToken && refreshToken)),
    normalizedUrl,
    refreshToken,
    state,
    target: resolveSupabaseDeepLinkTarget(parsed.path || ""),
    trustedDeepLink: isTrustedAuthDeepLink({
      appScheme: params.appScheme,
      parsed,
      url: normalizedUrl,
    }),
  };
}

export function resolveExpectedAuthFlow(target: SupabaseDeepLinkTarget) {
  if (target === "AuthCallback") return "signup";
  if (target === "ResetPassword") return "password-reset";
  return undefined;
}

export function shouldRejectSupabaseAuthPayload(params: {
  expectedFlow?: string;
  flow?: string;
  hadAuthPayload: boolean;
  target: SupabaseDeepLinkTarget;
  trackedFlow?: string | null;
  trackedRedirect: boolean;
  trustedDeepLink: boolean;
}) {
  if (!params.hadAuthPayload) return false;
  return (
    !params.trustedDeepLink ||
    !params.target ||
    !params.trackedRedirect ||
    params.flow !== params.expectedFlow ||
    params.trackedFlow !== params.expectedFlow
  );
}

export function canApplyPasswordResetSession(params: {
  target: SupabaseDeepLinkTarget;
  trackedFlow?: string | null;
}) {
  return params.target === "ResetPassword" && params.trackedFlow === "password-reset";
}

export function isSupabaseAuthStorageKey(key: string, projectId: string) {
  const lowered = String(key || "").toLowerCase();
  const normalizedProjectId = String(projectId || "")
    .trim()
    .toLowerCase();
  return (
    key === `sb-${projectId}-auth-token` ||
    key === `sb-${projectId}-auth-token-code-verifier` ||
    (lowered.startsWith("sb-") && lowered.includes("auth-token")) ||
    lowered.includes(`${normalizedProjectId}-auth-token`) ||
    lowered.includes("supabase.auth.token")
  );
}
