const SENSITIVE_KEY_PATTERNS = [
  /access[_-]?token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /password/i,
  /refresh[_-]?token/i,
  /secret/i,
  /signature/i,
  /signed[_-]?url/i,
  /token/i,
];

const AUTH_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/=]+\b/gi;
const EMAIL_PATTERN = /\b([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const QUERY_SECRET_PATTERN =
  /([?&#](?:access_token|refresh_token|token|apikey|api_key|code|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token)=)([^&#\s"'<>]+)/gi;

function truncate(value: string, maxLength = 240) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...[truncated]`;
}

function maskEmail(value: string) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "[redacted-email]";
  const safeLocal =
    localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

function redactQuerySecrets(value: string) {
  return value.replace(QUERY_SECRET_PATTERN, (_match, prefix) => `${prefix}[redacted]`);
}

function redactAuthorizationValue(value: string) {
  return value.replace(AUTH_VALUE_PATTERN, "Bearer [redacted]");
}

function redactEmails(value: string) {
  return value.replace(EMAIL_PATTERN, (_match, localPart, domain) =>
    maskEmail(`${localPart}@${domain}`),
  );
}

function looksSensitiveKey(key: string) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || "")));
}

function sanitizePrimitive(value: string) {
  const scrubbed = redactEmails(redactAuthorizationValue(redactQuerySecrets(value)));
  return truncate(scrubbed);
}

export function redactString(value: string) {
  return sanitizePrimitive(String(value || ""));
}

export function redactValue<T>(value: T, depth = 0): T {
  if (depth > 4) {
    return "[truncated]" as T;
  }

  if (value == null) return value;

  if (typeof value === "string") {
    return sanitizePrimitive(value) as T;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1)) as T;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        looksSensitiveKey(key) ? "[redacted]" : redactValue(item, depth + 1),
      ]),
    ) as T;
  }

  return String(value) as T;
}

export function sanitizeEmailForLogs(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized ? maskEmail(normalized) : "";
}
