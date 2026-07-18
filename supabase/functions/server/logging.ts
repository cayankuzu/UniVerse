import { VERBOSE_EDGE_REQUEST_LOGS } from "./runtime.ts";

const REDACTED_KEYS = [
  "access_token",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "refresh_token",
  "secret",
  "signature",
  "signed_url",
  "signedurl",
  "token",
];
const EMAIL_PATTERN = /\b([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const QUERY_SECRET_PATTERN =
  /([?&#](?:access_token|refresh_token|token|apikey|api_key|code|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token)=)([^&#]+)/gi;
const AUTH_HEADER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/=]+\b/gi;

type JsonMeta = Record<string, unknown>;

function isRedactedKey(key: string) {
  const normalized = String(key || "")
    .trim()
    .toLowerCase();
  return REDACTED_KEYS.some((candidate) => normalized.includes(candidate));
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonMeta).map(([key, item]) => [
        key,
        isRedactedKey(key) ? "[redacted]" : redactValue(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") {
    const scrubbed = value
      .replace(QUERY_SECRET_PATTERN, (_match, prefix) => `${prefix}[redacted]`)
      .replace(AUTH_HEADER_PATTERN, "Bearer [redacted]")
      .replace(
        EMAIL_PATTERN,
        (_match, localPart, domain) => `${String(localPart).slice(0, 2)}***@${domain}`,
      );
    if (scrubbed.length > 600) {
      return `${scrubbed.slice(0, 600)}...[truncated]`;
    }
    return scrubbed;
  }
  return value;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ? error.stack.split("\n").slice(0, 6).join("\n") : undefined,
    };
  }
  return {
    message: String(error || "unknown_error"),
  };
}

function writeLog(level: "error" | "info", scope: string, message: string, meta?: JsonMeta) {
  const payload = {
    level,
    message,
    meta: meta ? redactValue(meta) : undefined,
    scope,
    timestamp: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    // Structured, redacted JSON is the edge runtime logging boundary.
    // eslint-disable-next-line no-console
    console.error(serialized);
    return;
  }
  // eslint-disable-next-line no-console
  console.info(serialized);
}

export function logInfo(scope: string, message: string, meta?: JsonMeta) {
  writeLog("info", scope, message, meta);
}

export function logError(scope: string, message: string, error: unknown, meta?: JsonMeta) {
  writeLog("error", scope, message, {
    ...meta,
    error: serializeError(error),
  });
}

export function logEdgeRequest(meta: {
  elapsedMs: number;
  method: string;
  path: string;
  status: number;
  slow: boolean;
}) {
  if (!VERBOSE_EDGE_REQUEST_LOGS && !meta.slow && meta.status < 400) {
    return;
  }
  logInfo("edge-request", "request-completed", meta);
}
