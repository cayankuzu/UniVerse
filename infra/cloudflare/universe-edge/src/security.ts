import {
  createRemoteJWKSet,
  customFetch,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
  type FetchImplementation,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { readBoundedResponseJson } from "./body";
import { GatewayError } from "./errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
export const ORIGIN_SIGNATURE_VERSION = "2";
const textEncoder = new TextEncoder();
const remoteJwkSetsByFetcher = new WeakMap<typeof fetch, Map<string, JWTVerifyGetKey>>();

class AuthProviderUnavailableError extends Error {
  constructor() {
    super("auth_provider_unavailable");
    this.name = "AuthProviderUnavailableError";
  }
}

export type VerifiedIdentity = {
  subject: string;
};

export type JwtVerificationConfig = {
  audience: string;
  issuer: string;
  publishableKey: string;
  supabaseUrl: string;
};

function getJoseErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function isRemoteJwksUnavailable(error: unknown): boolean {
  if (error instanceof AuthProviderUnavailableError) return true;
  return ["ERR_JOSE_GENERIC", "ERR_JWK_INVALID", "ERR_JWKS_INVALID", "ERR_JWKS_TIMEOUT"].includes(
    getJoseErrorCode(error),
  );
}

function getRemoteJwkSet(config: JwtVerificationConfig, fetcher: typeof fetch): JWTVerifyGetKey {
  const jwksUrl = `${config.supabaseUrl}/auth/v1/.well-known/jwks.json`;
  let keySetsByUrl = remoteJwkSetsByFetcher.get(fetcher);
  if (!keySetsByUrl) {
    keySetsByUrl = new Map();
    remoteJwkSetsByFetcher.set(fetcher, keySetsByUrl);
  }
  const cached = keySetsByUrl.get(jwksUrl);
  if (cached) return cached;

  const fetchJwks: FetchImplementation = async (url, options) => {
    let response: Response;
    try {
      response = await fetcher(url, options);
    } catch {
      throw new AuthProviderUnavailableError();
    }
    if (response.status !== 200) {
      if (response.body) void response.body.cancel("unexpected JWKS status").catch(() => undefined);
      throw new AuthProviderUnavailableError();
    }
    try {
      const jwks = await readBoundedResponseJson(response);
      return Response.json(jwks);
    } catch {
      throw new AuthProviderUnavailableError();
    }
  };
  const keySet = createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 10 * 60_000,
    cooldownDuration: 30_000,
    timeoutDuration: 3000,
    [customFetch]: fetchJwks,
  });
  keySetsByUrl.set(jwksUrl, keySet);
  return keySet;
}

export function extractBearerToken(request: Request): string {
  const authorization = String(request.headers.get("authorization") || "");
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new GatewayError("authentication_required", 401, "Kimlik doğrulama gerekli.");
  }
  if (match[1].length > 8192) {
    throw new GatewayError("invalid_token", 401, "Oturum doğrulanamadı.");
  }
  return match[1];
}

export function resolveRequestId(
  request: Request,
  generate: () => string = () => crypto.randomUUID(),
): string {
  const supplied = String(request.headers.get("x-request-id") || "").trim();
  return REQUEST_ID_PATTERN.test(supplied) ? supplied : generate();
}

function validateClaims(
  claims: JWTPayload,
  config: JwtVerificationConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedIdentity {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== config.issuer || !audience.includes(config.audience)) {
    throw new GatewayError("invalid_token_claims", 401, "Oturum doğrulanamadı.");
  }
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds - 5) {
    throw new GatewayError("expired_token", 401, "Oturum süresi doldu.");
  }
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 5) {
    throw new GatewayError("inactive_token", 401, "Oturum henüz geçerli değil.");
  }
  if (typeof claims.iat === "number" && claims.iat > nowSeconds + 60) {
    throw new GatewayError("future_token", 401, "Oturum doğrulanamadı.");
  }
  const subject = String(claims.sub || "").trim();
  if (!UUID_PATTERN.test(subject) || claims.role !== "authenticated") {
    throw new GatewayError("invalid_token_subject", 401, "Oturum doğrulanamadı.");
  }
  return { subject };
}

export async function verifyAsymmetricSupabaseJwt(
  token: string,
  config: JwtVerificationConfig,
  keySet?: JWTVerifyGetKey,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const remoteKeySet = keySet ?? getRemoteJwkSet(config, fetcher);
  try {
    const { payload } = await jwtVerify(token, remoteKeySet, {
      algorithms: ["ES256", "RS256"],
      audience: config.audience,
      clockTolerance: 5,
      issuer: config.issuer,
      requiredClaims: ["aud", "exp", "iss", "sub"],
    });
    return validateClaims(payload, config);
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (!keySet && isRemoteJwksUnavailable(error)) {
      throw new GatewayError("auth_unavailable", 503, "Kimlik doğrulama kullanılamıyor.");
    }
    throw new GatewayError("invalid_token", 401, "Oturum doğrulanamadı.");
  }
}

export async function verifyLegacySupabaseJwt(
  token: string,
  config: JwtVerificationConfig,
  fetcher: typeof fetch,
): Promise<VerifiedIdentity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetcher(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if ([400, 401, 403].includes(response.status)) {
      if (response.body) void response.body.cancel("rejected auth response").catch(() => undefined);
      throw new GatewayError("invalid_token", 401, "Oturum doğrulanamadı.");
    }
    if (!response.ok) {
      if (response.body) void response.body.cancel("unexpected auth status").catch(() => undefined);
      throw new GatewayError("auth_unavailable", 503, "Kimlik doğrulama kullanılamıyor.");
    }
    let authUser: unknown;
    try {
      authUser = await readBoundedResponseJson(response);
    } catch {
      throw new GatewayError("auth_unavailable", 503, "Kimlik doğrulama kullanılamıyor.");
    }
    let claims: JWTPayload;
    try {
      claims = decodeJwt(token);
    } catch {
      throw new GatewayError("invalid_token", 401, "Oturum doğrulanamadı.");
    }
    const identity = validateClaims(claims, config);
    const authUserId =
      authUser && typeof authUser === "object" && "id" in authUser
        ? String(authUser.id || "").trim()
        : "";
    if (authUserId !== identity.subject) {
      throw new GatewayError("invalid_token_subject", 401, "Oturum doğrulanamadı.");
    }
    return identity;
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError("auth_unavailable", 503, "Kimlik doğrulama kullanılamıyor.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifySupabaseJwt(
  token: string,
  config: JwtVerificationConfig,
  fetcher: typeof fetch,
): Promise<VerifiedIdentity> {
  let algorithm: string;
  try {
    algorithm = String(decodeProtectedHeader(token).alg || "");
  } catch {
    throw new GatewayError("invalid_token", 401, "Oturum doğrulanamadı.");
  }
  if (algorithm === "HS256") {
    return verifyLegacySupabaseJwt(token, config, fetcher);
  }
  if (algorithm === "ES256" || algorithm === "RS256") {
    return verifyAsymmetricSupabaseJwt(token, config, undefined, fetcher);
  }
  throw new GatewayError("unsupported_token_algorithm", 401, "Oturum doğrulanamadı.");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer));
}

export async function buildRateLimitKey(salt: string, parts: readonly string[]): Promise<string> {
  return toBase64Url(await sha256(`${salt}\n${parts.join("\n")}`));
}

export function canonicalizePath(url: URL): string {
  const sorted = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );
  const query = new URLSearchParams(sorted).toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export async function signOriginRequest(params: {
  body: Uint8Array;
  canonicalPath: string;
  clientNetworkKey: string;
  method: string;
  nonce: string;
  secret: string;
  timestamp: string;
}): Promise<{ bodyHash: string; signature: string; signatureVersion: string }> {
  const bodyHash = toHex(await sha256(params.body));
  const canonical = [
    ORIGIN_SIGNATURE_VERSION,
    params.timestamp,
    params.nonce,
    params.method.toUpperCase(),
    params.canonicalPath,
    params.clientNetworkKey,
    bodyHash,
  ].join("\n");
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(params.secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(canonical)),
  );
  return {
    bodyHash,
    signature: toBase64Url(signature),
    signatureVersion: ORIGIN_SIGNATURE_VERSION,
  };
}
