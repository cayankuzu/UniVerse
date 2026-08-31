import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { readVerifiedClientNetworkSubject } from "./services/verifiedClientNetwork.ts";

type HeaderReader = {
  req: {
    header(name: string): string | undefined;
    raw?: Request;
  };
};

type RateLimitRpcRow = {
  allowed?: boolean | null;
  current_count?: number | null;
  reset_at?: string | null;
};

export type RateLimitWindowResult = {
  allowed: boolean;
  currentCount: number;
  resetAt: string | null;
};

let _client: ReturnType<typeof createClient> | null = null;

function readRequiredEnv(...names: string[]) {
  for (const name of names) {
    const value = String(Deno.env.get(name) || "").trim();
    if (value) return value;
  }
  throw new Error(
    `[rate-limit] Missing required environment variable. Checked: ${names.join(", ")}`,
  );
}

function client() {
  if (!_client) {
    _client = createClient(
      readRequiredEnv("SUPABASE_URL"),
      readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"),
    );
  }
  return _client;
}

function normalizeRateLimitKey(value: string, fallback: string, maxLength: number) {
  const normalized = String(value || "")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function normalizeSingleIp(value: string | undefined) {
  const normalized =
    String(value || "")
      .split(",")[0]
      ?.trim() || "";
  return normalized.slice(0, 80);
}

export function getRequestClientAddress(c: HeaderReader) {
  const verifiedClientNetworkSubject = readVerifiedClientNetworkSubject(c.req.raw);
  if (verifiedClientNetworkSubject) return verifiedClientNetworkSubject;
  return (
    [
      c.req.header("cf-connecting-ip"),
      c.req.header("fly-client-ip"),
      c.req.header("true-client-ip"),
      c.req.header("x-real-ip"),
    ]
      .map(normalizeSingleIp)
      .find(Boolean) || "anonymous"
  );
}

export async function consumeRateLimitWindow(params: {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitWindowResult> {
  const { data, error } = await client().rpc("consume_server_rate_limit", {
    limit_count: Math.max(1, Math.trunc(Number(params.limit || 0))),
    target_scope: normalizeRateLimitKey(params.scope, "global", 120),
    target_subject: normalizeRateLimitKey(params.subject, "anonymous", 240),
    window_ms: Math.max(1000, Math.trunc(Number(params.windowMs || 0))),
  });
  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcRow | null;
  return {
    allowed: Boolean(row?.allowed),
    currentCount: Math.max(0, Math.trunc(Number(row?.current_count || 0))),
    resetAt: row?.reset_at ? String(row.reset_at) : null,
  };
}

export async function consumeRateLimit(params: {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
}) {
  const row = await consumeRateLimitWindow(params);
  return row.allowed;
}

export async function consumeScopedRateLimit(params: {
  scope: string;
  subjects: string[];
  limit: number;
  windowMs: number;
}) {
  const uniqueSubjects = Array.from(
    new Set(params.subjects.map((value) => String(value || "").trim()).filter(Boolean)),
  );
  if (uniqueSubjects.length === 0) return true;

  const results = await Promise.all(
    uniqueSubjects.map((subject) =>
      consumeRateLimit({
        limit: params.limit,
        scope: params.scope,
        subject,
        windowMs: params.windowMs,
      }),
    ),
  );

  return results.every(Boolean);
}
