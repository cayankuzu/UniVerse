const EDGE_ROUTE_PREFIX = "/server/make-server-e3557d40";
const EMPTY_BYTES = new Uint8Array();
const BODY_HASH_PATTERN = /^[a-f0-9]{64}$/;
const CLIENT_NETWORK_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TIMESTAMP_PATTERN = /^\d{1,13}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGIN_SIGNATURE_VERSION = "2";
const textEncoder = new TextEncoder();

export type CloudflareOriginVerificationMode = "enforce" | "observe" | "off";

export type CloudflareOriginVerificationConfig = {
  maxClockSkewSeconds: number;
  mode: CloudflareOriginVerificationMode;
  secret: string;
};

export type OriginNonceClaim = {
  expiresAt: string;
  nonce: string;
  requestId: string;
  requestTimestamp: string;
  routeId: string;
};

export type CloudflareOriginVerificationDependencies = {
  claimNonce: (claim: OriginNonceClaim) => Promise<boolean>;
  now?: () => number;
};

export type CloudflareOriginVerificationResult = {
  clientNetworkKey?: string;
  outcome: "disabled" | "not_selected" | "observed_unsigned" | "verified";
  routeId?: string;
};

export type SelectedOriginRoute = {
  canonicalPath: string;
  id: string;
  maxBodyBytes: number;
};

type OriginRoutePolicy = {
  id: string;
  matcher: RegExp;
  maxBodyBytes: number;
  methods: readonly string[];
};

const ORIGIN_ROUTE_POLICIES: readonly OriginRoutePolicy[] = [
  {
    id: "health",
    matcher: /^\/health$/,
    maxBodyBytes: 0,
    methods: ["GET"],
  },
  {
    id: "auth.check-username",
    matcher: /^\/auth\/check-username\/[a-z0-9_]{3,24}$/,
    maxBodyBytes: 0,
    methods: ["GET"],
  },
  {
    id: "auth.check-email",
    matcher: /^\/auth\/check-email$/,
    maxBodyBytes: 0,
    methods: ["GET"],
  },
  {
    id: "auth.register-direct",
    matcher: /^\/auth\/register-direct$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
  },
  {
    id: "auth.register",
    matcher: /^\/auth\/register$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
  },
  {
    id: "reports.create",
    matcher: /^\/reports$/,
    maxBodyBytes: 4096,
    methods: ["POST"],
  },
  {
    id: "storage.upload-session.create",
    matcher: /^\/storage\/upload-session\/create$/,
    maxBodyBytes: 16_384,
    methods: ["POST"],
  },
  {
    id: "storage.upload-session.finalize",
    matcher: /^\/storage\/upload-session\/finalize$/,
    maxBodyBytes: 1024,
    methods: ["POST"],
  },
  {
    id: "storage.upload-session.cancel",
    matcher: /^\/storage\/upload-session\/cancel$/,
    maxBodyBytes: 1024,
    methods: ["POST"],
  },
] as const;

const SIGNED_HEADER_NAMES = [
  "x-universe-edge-body-sha256",
  "x-universe-edge-canonical-path",
  "x-universe-edge-client-network-key",
  "x-universe-edge-nonce",
  "x-universe-edge-signature",
  "x-universe-edge-signature-version",
  "x-universe-edge-timestamp",
] as const;

export class CloudflareOriginVerificationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "CloudflareOriginVerificationError";
    this.code = code;
    this.status = status;
  }
}

export function readCloudflareOriginVerificationConfig(params: {
  maxClockSkewSeconds?: string;
  mode?: string;
  secret?: string;
}): CloudflareOriginVerificationConfig {
  const modeValue = String(params.mode || "off")
    .trim()
    .toLowerCase();
  if (modeValue !== "off" && modeValue !== "observe" && modeValue !== "enforce") {
    throw new Error("[origin-verification] Invalid mode; expected off, observe, or enforce.");
  }

  const secret = String(params.secret || "");
  if (modeValue !== "off" && secret.length < 32) {
    throw new Error(
      "[origin-verification] ORIGIN_HMAC_SECRET must contain at least 32 characters.",
    );
  }

  const rawSkew = String(params.maxClockSkewSeconds || "120").trim();
  if (!/^\d{1,4}$/.test(rawSkew)) {
    throw new Error("[origin-verification] Invalid clock skew configuration.");
  }
  const maxClockSkewSeconds = Number(rawSkew);
  if (maxClockSkewSeconds < 30 || maxClockSkewSeconds > 300) {
    throw new Error("[origin-verification] Clock skew must be between 30 and 300 seconds.");
  }

  return {
    maxClockSkewSeconds,
    mode: modeValue,
    secret,
  };
}

function canonicalizePath(pathname: string, searchParams: URLSearchParams): string {
  const sorted = [...searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );
  const query = new URLSearchParams(sorted).toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function resolveSelectedOriginRoute(
  requestUrl: string,
  method: string,
): SelectedOriginRoute | null {
  const url = new URL(requestUrl);
  if (!url.pathname.startsWith(`${EDGE_ROUTE_PREFIX}/`)) return null;

  const publicPath = url.pathname.slice(EDGE_ROUTE_PREFIX.length);
  const normalizedMethod = String(method || "").toUpperCase();
  const policy = ORIGIN_ROUTE_POLICIES.find(
    (candidate) =>
      candidate.methods.includes(normalizedMethod) && candidate.matcher.test(publicPath),
  );
  if (!policy) return null;

  return {
    canonicalPath: canonicalizePath(publicPath, url.searchParams),
    id: policy.id,
    maxBodyBytes: policy.maxBodyBytes,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer));
}

async function signCanonicalRequest(secret: string, canonical: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(canonical))),
  );
}

async function readBoundedBody(request: Request, maxBodyBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBodyBytes) {
      throw new CloudflareOriginVerificationError("origin_body_too_large", 413);
    }
  }

  const body = request.clone().body;
  if (!body) return EMPTY_BYTES;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let streamComplete = false;
  try {
    while (!streamComplete) {
      const { done, value } = await reader.read();
      streamComplete = done;
      if (streamComplete) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        void reader.cancel().catch(() => undefined);
        throw new CloudflareOriginVerificationError("origin_body_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function readSignedHeaders(request: Request) {
  const values = Object.fromEntries(
    SIGNED_HEADER_NAMES.map((name) => [name, String(request.headers.get(name) || "").trim()]),
  );
  const presentCount = SIGNED_HEADER_NAMES.filter((name) => Boolean(values[name])).length;
  return { presentCount, values };
}

export async function verifyCloudflareOriginRequest(
  request: Request,
  config: CloudflareOriginVerificationConfig,
  dependencies: CloudflareOriginVerificationDependencies,
): Promise<CloudflareOriginVerificationResult> {
  const route = resolveSelectedOriginRoute(request.url, request.method);
  if (!route) return { outcome: "not_selected" };
  if (config.mode === "off") return { outcome: "disabled", routeId: route.id };

  const signedHeaders = readSignedHeaders(request);
  if (signedHeaders.presentCount === 0) {
    if (config.mode === "observe") {
      return { outcome: "observed_unsigned", routeId: route.id };
    }
    throw new CloudflareOriginVerificationError("origin_signature_required", 401);
  }
  if (signedHeaders.presentCount !== SIGNED_HEADER_NAMES.length) {
    throw new CloudflareOriginVerificationError("origin_signature_incomplete", 401);
  }

  const bodyHash = signedHeaders.values["x-universe-edge-body-sha256"];
  const canonicalPath = signedHeaders.values["x-universe-edge-canonical-path"];
  const clientNetworkKey = signedHeaders.values["x-universe-edge-client-network-key"];
  const nonce = signedHeaders.values["x-universe-edge-nonce"];
  const signature = signedHeaders.values["x-universe-edge-signature"];
  const signatureVersion = signedHeaders.values["x-universe-edge-signature-version"];
  const timestamp = signedHeaders.values["x-universe-edge-timestamp"];
  const requestId = String(request.headers.get("x-request-id") || "").trim();

  if (
    !BODY_HASH_PATTERN.test(bodyHash) ||
    !CLIENT_NETWORK_KEY_PATTERN.test(clientNetworkKey) ||
    !UUID_PATTERN.test(nonce) ||
    !SIGNATURE_PATTERN.test(signature) ||
    signatureVersion !== ORIGIN_SIGNATURE_VERSION ||
    !TIMESTAMP_PATTERN.test(timestamp) ||
    !REQUEST_ID_PATTERN.test(requestId) ||
    canonicalPath.length > 2048 ||
    !constantTimeEqual(canonicalPath, route.canonicalPath)
  ) {
    throw new CloudflareOriginVerificationError("origin_signature_invalid", 401);
  }

  const timestampSeconds = Number(timestamp);
  const nowMilliseconds = (dependencies.now || Date.now)();
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > config.maxClockSkewSeconds
  ) {
    throw new CloudflareOriginVerificationError("origin_timestamp_invalid", 401);
  }

  const body = await readBoundedBody(request, route.maxBodyBytes);
  const computedBodyHash = toHex(await sha256(body));
  if (!constantTimeEqual(bodyHash, computedBodyHash)) {
    throw new CloudflareOriginVerificationError("origin_body_hash_invalid", 401);
  }

  const canonical = [
    signatureVersion,
    timestamp,
    nonce,
    request.method.toUpperCase(),
    route.canonicalPath,
    clientNetworkKey,
    computedBodyHash,
  ].join("\n");
  const computedSignature = await signCanonicalRequest(config.secret, canonical);
  if (!constantTimeEqual(signature, computedSignature)) {
    throw new CloudflareOriginVerificationError("origin_signature_invalid", 401);
  }

  const expiresAt = new Date(
    (timestampSeconds + config.maxClockSkewSeconds + 1) * 1000,
  ).toISOString();
  let claimed = false;
  try {
    claimed = await dependencies.claimNonce({
      expiresAt,
      nonce,
      requestId,
      requestTimestamp: new Date(timestampSeconds * 1000).toISOString(),
      routeId: route.id,
    });
  } catch {
    throw new CloudflareOriginVerificationError("origin_nonce_store_unavailable", 503);
  }
  if (!claimed) {
    throw new CloudflareOriginVerificationError("origin_request_replayed", 409);
  }

  return { clientNetworkKey, outcome: "verified", routeId: route.id };
}
