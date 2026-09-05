import { parseAndNormalizeJsonBody, readBoundedRequestBody, readBoundedResponseBody } from "./body";
import { asGatewayError, GatewayError } from "./errors";
import {
  findRoutePolicy,
  type RateLimitPolicy,
  type RoutePolicy,
  validateRouteQuery,
} from "./routePolicy";
import {
  buildRateLimitKey,
  canonicalizePath,
  extractBearerToken,
  resolveRequestId,
  signOriginRequest,
  verifySupabaseJwt,
  type JwtVerificationConfig,
  type VerifiedIdentity,
} from "./security";

type GatewayConfig = JwtVerificationConfig & {
  allowedOrigins: ReadonlySet<string>;
  environment: "development" | "preview" | "production";
  originBaseUrl: string;
  originHmacSecret: string;
  rateLimitSalt: string;
  timeoutMs: number;
};

export type GatewayDependencies = {
  fetcher: typeof fetch;
  now: () => number;
  randomUuid: () => string;
  verifyJwt: (
    token: string,
    config: JwtVerificationConfig,
    fetcher: typeof fetch,
  ) => Promise<VerifiedIdentity>;
};

const defaultDependencies: GatewayDependencies = {
  fetcher: fetch,
  now: Date.now,
  randomUuid: () => crypto.randomUUID(),
  verifyJwt: verifySupabaseJwt,
};

const MAX_HEALTH_ORIGIN_RESPONSE_BYTES = 4_096;
const MAX_ORIGIN_RESPONSE_BYTES = 512 * 1_024;
const ORIGIN_FUNCTION_PATH = "/functions/v1/server/make-server-e3557d40";

type BufferedOriginResponse = {
  body: Uint8Array;
  headers: Headers;
  status: number;
  statusText: string;
};

function configError(): GatewayError {
  return new GatewayError("configuration_error", 503, "Edge gateway yapılandırması eksik.");
}

function parseHttpsUrl(value: string, environment: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw configError();
  }
  const localDevelopment =
    environment === "development" &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if ((!localDevelopment && parsed.protocol !== "https:") || parsed.hostname.endsWith(".invalid")) {
    throw configError();
  }
  if (parsed.username || parsed.password || parsed.hash) throw configError();
  return parsed;
}

export function readGatewayConfig(env: Env): GatewayConfig {
  const environment = env.ENVIRONMENT;
  if (environment !== "development" && environment !== "preview" && environment !== "production") {
    throw configError();
  }
  const supabaseUrl = parseHttpsUrl(env.SUPABASE_URL, environment);
  const originBaseUrl = parseHttpsUrl(env.ORIGIN_BASE_URL, environment);
  const issuer = parseHttpsUrl(env.JWT_ISSUER, environment);
  if (supabaseUrl.pathname !== "/" || supabaseUrl.search) throw configError();
  if (
    originBaseUrl.origin !== supabaseUrl.origin ||
    originBaseUrl.pathname.replace(/\/+$/, "") !== ORIGIN_FUNCTION_PATH ||
    originBaseUrl.search
  ) {
    throw configError();
  }
  if (issuer.toString().replace(/\/$/, "") !== `${supabaseUrl.origin}/auth/v1`) throw configError();

  const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS);
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  const originHmacSecret = String(env.ORIGIN_HMAC_SECRET || "");
  const rateLimitSalt = String(env.RATE_LIMIT_SALT || "");
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 15_000 ||
    publishableKey.length < 20 ||
    originHmacSecret.length < 32 ||
    rateLimitSalt.length < 32
  ) {
    throw configError();
  }

  const origins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origins.includes("*")) throw configError();
  const canonicalOrigins = origins.map((origin) => {
    const parsed = parseHttpsUrl(origin, environment);
    if (parsed.pathname !== "/" || parsed.search) throw configError();
    return parsed.origin;
  });

  return {
    allowedOrigins: new Set(canonicalOrigins),
    audience: String(env.JWT_AUDIENCE || "").trim(),
    environment,
    issuer: issuer.toString().replace(/\/$/, ""),
    originBaseUrl: `${originBaseUrl.origin}${ORIGIN_FUNCTION_PATH}`,
    originHmacSecret,
    publishableKey,
    rateLimitSalt,
    supabaseUrl: supabaseUrl.origin,
    timeoutMs,
  };
}

function isAllowedOrigin(request: Request, config: GatewayConfig): boolean {
  const origin = String(request.headers.get("origin") || "")
    .trim()
    .replace(/\/$/, "");
  return !origin || config.allowedOrigins.has(origin);
}

function addGatewayHeaders(
  response: Response,
  request: Request,
  config: GatewayConfig | null,
  requestId: string,
): Response {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-request-id", requestId);
  const cfRay = String(request.headers.get("cf-ray") || "").trim();
  if (cfRay) headers.set("x-edge-cf-ray", cfRay.slice(0, 128));
  const origin = String(request.headers.get("origin") || "")
    .trim()
    .replace(/\/$/, "");
  if (origin && config?.allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "Origin");
  } else {
    headers.delete("access-control-allow-origin");
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function jsonResponse(payload: unknown, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { headers, status });
}

function errorResponse(error: GatewayError, requestId: string): Response {
  return jsonResponse(
    { code: error.code, error: error.message, requestId },
    error.status,
    error.status === 429 ? { "retry-after": "60" } : undefined,
  );
}

function preflightResponse(request: Request, policy: RoutePolicy, config: GatewayConfig): Response {
  const origin = String(request.headers.get("origin") || "")
    .trim()
    .replace(/\/$/, "");
  const requestedMethod = String(
    request.headers.get("access-control-request-method") || "",
  ).toUpperCase();
  if (!origin || !config.allowedOrigins.has(origin)) {
    throw new GatewayError("origin_not_allowed", 403, "Origin kabul edilmiyor.");
  }
  if (!policy.methods.includes(requestedMethod as "GET" | "POST")) {
    throw new GatewayError("method_not_allowed", 405, "HTTP metodu desteklenmiyor.");
  }
  return new Response(null, {
    headers: {
      "access-control-allow-headers":
        "Authorization, Content-Type, Idempotency-Key, X-Client-Info, X-Request-Id, apikey",
      "access-control-allow-methods": policy.methods.join(", "),
      "access-control-allow-origin": origin,
      "access-control-max-age": "600",
      vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    },
    status: 204,
  });
}

function getRateLimitBinding(env: Env, policy: RateLimitPolicy): RateLimit | null {
  if (policy === "none") return null;
  const limiter =
    policy === "auth"
      ? env.AUTH_RATE_LIMITER
      : policy === "report"
        ? env.REPORT_RATE_LIMITER
        : env.UPLOAD_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") throw configError();
  return limiter;
}

function anonymousRateIdentifier(policy: RoutePolicy, url: URL, parsedBody: unknown): string {
  if (policy.id === "auth.check-email") {
    return String(url.searchParams.get("email") || "")
      .trim()
      .toLowerCase();
  }
  if (policy.id === "auth.check-username") {
    return url.pathname.split("/").pop()?.trim().toLowerCase() || "missing";
  }
  if (policy.id === "auth.register-direct" && parsedBody && typeof parsedBody === "object") {
    const body = parsedBody as { email?: unknown; existingUserId?: unknown };
    return `${String(body.email || "")
      .trim()
      .toLowerCase()}:${String(body.existingUserId || "").trim()}`;
  }
  return policy.id;
}

async function enforceRateLimitDimension(params: {
  config: GatewayConfig;
  env: Env;
  dimension: "actor" | "network";
  policy: RoutePolicy;
  subject: string;
}): Promise<void> {
  const limiter = getRateLimitBinding(params.env, params.policy.rateLimit);
  if (!limiter) return;
  const key = await buildRateLimitKey(params.config.rateLimitSalt, [
    params.config.environment,
    params.policy.id,
    params.dimension,
    params.subject,
  ]);
  const result = await limiter.limit({ key });
  if (!result.success) {
    throw new GatewayError(
      "rate_limited",
      429,
      "Çok fazla istek var. Lütfen sonra tekrar deneyin.",
    );
  }
}

async function enforceNetworkRateLimit(params: {
  config: GatewayConfig;
  env: Env;
  policy: RoutePolicy;
  request: Request;
}): Promise<void> {
  await enforceRateLimitDimension({
    config: params.config,
    dimension: "network",
    env: params.env,
    policy: params.policy,
    subject: resolveClientNetwork(params.request),
  });
}

async function enforceActorRateLimit(params: {
  config: GatewayConfig;
  env: Env;
  identity: VerifiedIdentity | null;
  parsedBody: unknown;
  policy: RoutePolicy;
  url: URL;
}): Promise<void> {
  await enforceRateLimitDimension({
    config: params.config,
    dimension: "actor",
    env: params.env,
    policy: params.policy,
    subject:
      params.identity?.subject ??
      anonymousRateIdentifier(params.policy, params.url, params.parsedBody),
  });
}

function resolveClientNetwork(request: Request): string {
  return (
    String(request.headers.get("cf-connecting-ip") || "")
      .trim()
      .slice(0, 80) || "unknown-network"
  );
}

function validateIdempotencyHeader(request: Request): void {
  const value = String(request.headers.get("idempotency-key") || "").trim();
  if (value && !/^[A-Za-z0-9._:-]{8,160}$/.test(value)) {
    throw new GatewayError("invalid_idempotency_key", 400, "Idempotency-Key geçersiz.");
  }
}

async function sleepBeforeRetry(attempt: number): Promise<void> {
  const random = new Uint16Array(1);
  crypto.getRandomValues(random);
  const jitter = (random[0] ?? 0) % 25;
  await new Promise<void>((resolve) => setTimeout(resolve, 25 * 2 ** attempt + jitter));
}

async function fetchOrigin(params: {
  baseHeaders: Headers;
  body: Uint8Array;
  canonicalPath: string;
  clientNetworkKey: string;
  config: GatewayConfig;
  dependencies: GatewayDependencies;
  method: string;
  policy: RoutePolicy;
  upstreamUrl: string;
}): Promise<BufferedOriginResponse> {
  const maxAttempts = params.policy.retryGet && params.method === "GET" ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const timestamp = String(Math.floor(params.dependencies.now() / 1000));
    const nonce = params.dependencies.randomUuid();
    const originSignature = await signOriginRequest({
      body: params.body,
      canonicalPath: params.canonicalPath,
      clientNetworkKey: params.clientNetworkKey,
      method: params.method,
      nonce,
      secret: params.config.originHmacSecret,
      timestamp,
    });
    const headers = new Headers(params.baseHeaders);
    headers.set("x-universe-edge-body-sha256", originSignature.bodyHash);
    headers.set("x-universe-edge-canonical-path", params.canonicalPath);
    headers.set("x-universe-edge-client-network-key", params.clientNetworkKey);
    headers.set("x-universe-edge-nonce", nonce);
    headers.set("x-universe-edge-signature", originSignature.signature);
    headers.set("x-universe-edge-signature-version", originSignature.signatureVersion);
    headers.set("x-universe-edge-timestamp", timestamp);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);
    let shouldRetry = false;
    try {
      const response = await params.dependencies.fetcher(params.upstreamUrl, {
        body: params.body.byteLength > 0 ? params.body.slice().buffer : undefined,
        headers,
        method: params.method,
        redirect: "manual",
        signal: controller.signal,
      });
      if (attempt + 1 < maxAttempts && [502, 503, 504].includes(response.status)) {
        if (response.body) {
          void response.body.cancel("retryable origin response").catch(() => undefined);
        }
        shouldRetry = true;
      } else {
        const maxResponseBytes =
          params.policy.id === "health"
            ? MAX_HEALTH_ORIGIN_RESPONSE_BYTES
            : MAX_ORIGIN_RESPONSE_BYTES;
        let body: Uint8Array;
        try {
          body = await readBoundedResponseBody(response, maxResponseBytes);
        } catch (error) {
          if (error instanceof GatewayError && error.code === "body_too_large") {
            controller.abort("origin response limit exceeded");
            throw params.policy.id === "health"
              ? invalidOriginHealth()
              : new GatewayError(
                  "origin_response_too_large",
                  502,
                  "Backend yanıtı izin verilen boyutu aşıyor.",
                );
          }
          throw error;
        }
        return {
          body,
          headers: new Headers(response.headers),
          status: response.status,
          statusText: response.statusText,
        };
      }
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      if (attempt + 1 < maxAttempts) {
        shouldRetry = true;
      } else {
        const errorName = String((error as { name?: unknown })?.name || "");
        const timedOut =
          controller.signal.aborted || errorName === "AbortError" || errorName === "TimeoutError";
        throw new GatewayError(
          timedOut ? "origin_timeout" : "origin_unavailable",
          timedOut ? 504 : 503,
          "Backend şu anda kullanılamıyor.",
        );
      }
    } finally {
      clearTimeout(timeout);
    }
    if (shouldRetry) await sleepBeforeRetry(attempt);
  }
  throw new GatewayError("origin_unavailable", 503, "Backend şu anda kullanılamıyor.");
}

function buildOriginResponse(response: BufferedOriginResponse): Response {
  const headers = new Headers();
  for (const header of ["content-language", "content-type", "retry-after"]) {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  }
  const originRequestId = response.headers.get("x-request-id");
  if (originRequestId) headers.set("x-origin-request-id", originRequestId.slice(0, 128));
  return new Response(response.body.byteLength > 0 ? response.body.slice().buffer : null, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const ORIGIN_HEALTH_FIELDS = [
  "authRecoveryEndpointsEnabled",
  "compatRoutesEnabled",
  "legacyEdgeReadsEnabled",
  "mediaScannerConfigured",
  "status",
] as const;

function invalidOriginHealth(): GatewayError {
  return new GatewayError("invalid_origin_health", 503, "Backend sağlık yanıtı doğrulanamadı.");
}

function verifyOriginHealthContract(response: BufferedOriginResponse): void {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (
    response.status < 200 ||
    response.status >= 300 ||
    !contentType.startsWith("application/json")
  ) {
    throw invalidOriginHealth();
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.body));
  } catch {
    throw invalidOriginHealth();
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidOriginHealth();
  }
  const health = payload as Record<string, unknown>;
  const fields = Object.keys(health).sort();
  if (
    fields.length !== ORIGIN_HEALTH_FIELDS.length ||
    fields.some((field, index) => field !== ORIGIN_HEALTH_FIELDS[index]) ||
    health.status !== "ok" ||
    health.legacyEdgeReadsEnabled !== false ||
    health.authRecoveryEndpointsEnabled !== false ||
    typeof health.compatRoutesEnabled !== "boolean" ||
    typeof health.mediaScannerConfigured !== "boolean"
  ) {
    throw invalidOriginHealth();
  }
}

function readWorkerVersionMetadata(env: Env): { id: string; tag: string } {
  const metadata = (
    env as Env & {
      CF_VERSION_METADATA?: { id?: unknown; tag?: unknown };
    }
  ).CF_VERSION_METADATA;
  if (!metadata || typeof metadata.id !== "string" || typeof metadata.tag !== "string") {
    throw configError();
  }
  return { id: metadata.id, tag: metadata.tag };
}

function buildHealthResponse(response: BufferedOriginResponse, env: Env): Response {
  verifyOriginHealthContract(response);
  const version = readWorkerVersionMetadata(env);
  const originResponse = buildOriginResponse(response);
  const headers = new Headers(originResponse.headers);
  headers.set("x-universe-worker-version-id", version.id);
  headers.set("x-universe-worker-version-tag", version.tag);
  return new Response(originResponse.body, {
    headers,
    status: originResponse.status,
    statusText: originResponse.statusText,
  });
}

async function proxySelectedRoute(params: {
  config: GatewayConfig;
  dependencies: GatewayDependencies;
  env: Env;
  policy: RoutePolicy;
  request: Request;
  requestId: string;
  url: URL;
}): Promise<Response> {
  const method = params.request.method.toUpperCase();
  try {
    validateRouteQuery(params.policy, params.url);
  } catch {
    throw new GatewayError("invalid_query", 400, "İstek sorgusu geçersiz.");
  }
  validateIdempotencyHeader(params.request);
  await enforceNetworkRateLimit({
    config: params.config,
    env: params.env,
    policy: params.policy,
    request: params.request,
  });
  const rawBody = await readBoundedRequestBody(params.request, params.policy.maxBodyBytes);
  const bodyResult = params.policy.bodySchema
    ? parseAndNormalizeJsonBody(params.request, rawBody, params.policy.bodySchema)
    : { normalizedBody: rawBody, parsedBody: null };

  let token = "";
  let identity: VerifiedIdentity | null = null;
  if (params.policy.auth === "required") {
    token = extractBearerToken(params.request);
    identity = await params.dependencies.verifyJwt(
      token,
      params.config,
      params.dependencies.fetcher,
    );
  }
  await enforceActorRateLimit({
    config: params.config,
    env: params.env,
    identity,
    parsedBody: bodyResult.parsedBody,
    policy: params.policy,
    url: params.url,
  });

  const upstreamUrl = new URL(`${params.config.originBaseUrl}${params.url.pathname}`);
  upstreamUrl.search = params.url.search;
  const canonicalPath = canonicalizePath(params.url);
  const clientNetworkKey = await buildRateLimitKey(params.config.rateLimitSalt, [
    "origin-client-network-v1",
    resolveClientNetwork(params.request),
  ]);

  const baseHeaders = new Headers({
    accept: "application/json",
    apikey: params.config.publishableKey,
    "x-request-id": params.requestId,
    "x-universe-edge-environment": params.config.environment,
  });
  if (bodyResult.normalizedBody.byteLength > 0) baseHeaders.set("content-type", "application/json");
  if (params.policy.auth === "required") {
    baseHeaders.set("authorization", `Bearer ${token}`);
  } else if (params.config.publishableKey.split(".").length === 3) {
    baseHeaders.set("authorization", `Bearer ${params.config.publishableKey}`);
  }
  const idempotencyKey = params.request.headers.get("idempotency-key");
  if (idempotencyKey) baseHeaders.set("idempotency-key", idempotencyKey);
  const clientInfo = String(params.request.headers.get("x-client-info") || "").trim();
  baseHeaders.set(
    "x-client-info",
    /^[A-Za-z0-9._/ :+-]{1,128}$/.test(clientInfo) ? clientInfo : "universe-edge/0.1",
  );

  const originResponse = await fetchOrigin({
    baseHeaders,
    body: bodyResult.normalizedBody,
    canonicalPath,
    clientNetworkKey,
    config: params.config,
    dependencies: params.dependencies,
    method,
    policy: params.policy,
    upstreamUrl: upstreamUrl.toString(),
  });
  if (params.policy.id === "health") {
    return buildHealthResponse(originResponse, params.env);
  }
  return buildOriginResponse(originResponse);
}

function safeLog(payload: Record<string, boolean | number | string>): void {
  // eslint-disable-next-line no-console -- Cloudflare Workers emit structured operational logs via console.
  console.log(JSON.stringify(payload));
}

export function createGateway(dependencyOverrides: Partial<GatewayDependencies> = {}) {
  const dependencies: GatewayDependencies = { ...defaultDependencies, ...dependencyOverrides };
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const startedAt = performance.now();
      const requestId = resolveRequestId(request, dependencies.randomUuid);
      const url = new URL(request.url);
      const policy = findRoutePolicy(url.pathname);
      let config: GatewayConfig | null = null;
      let response: Response;
      let outcomeCode = "ok";
      try {
        config = readGatewayConfig(env);
        if (!policy) throw new GatewayError("route_not_found", 404, "Route bulunamadı.");
        if (!isAllowedOrigin(request, config)) {
          throw new GatewayError("origin_not_allowed", 403, "Origin kabul edilmiyor.");
        }
        if (request.method.toUpperCase() === "OPTIONS") {
          response = preflightResponse(request, policy, config);
        } else if (!policy.methods.includes(request.method.toUpperCase() as "GET" | "POST")) {
          response = jsonResponse(
            { code: "method_not_allowed", error: "HTTP metodu desteklenmiyor.", requestId },
            405,
            { allow: policy.methods.join(", ") },
          );
          outcomeCode = "method_not_allowed";
        } else {
          response = await proxySelectedRoute({
            config,
            dependencies,
            env,
            policy,
            request,
            requestId,
            url,
          });
        }
      } catch (error) {
        const gatewayError = asGatewayError(error);
        outcomeCode = gatewayError.code;
        response = errorResponse(gatewayError, requestId);
      }
      const securedResponse = addGatewayHeaders(response, request, config, requestId);
      safeLog({
        durationMs: Math.round(performance.now() - startedAt),
        environment: config?.environment ?? "invalid",
        event: "edge_request",
        method: request.method,
        outcomeCode,
        requestId,
        route: policy?.id ?? "unmatched",
        status: securedResponse.status,
      });
      return securedResponse;
    },
  } satisfies ExportedHandler<Env>;
}
