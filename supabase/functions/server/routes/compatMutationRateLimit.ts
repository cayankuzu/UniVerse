import { consumeRateLimit, getRequestClientAddress } from "../rateLimit.ts";

const DEFAULT_RATE_LIMIT_MESSAGE = "Cok fazla istek var. Lutfen biraz sonra tekrar deneyin.";

type CompatRateLimitContext = {
  json: (body: unknown, status?: number) => Response | Promise<Response>;
  req: {
    header(name: string): string | undefined;
  };
};

type CompatMutationRateLimitParams = {
  c: CompatRateLimitContext;
  ipLimit: number;
  message?: string;
  scope: string;
  userId: string;
  userLimit: number;
  windowMs: number;
};

export async function ensureCompatMutationBudget(params: CompatMutationRateLimitParams) {
  const normalizedUserId = String(params.userId || "").trim();
  if (!normalizedUserId) return false;

  const ipAddress = getRequestClientAddress(params.c);
  const [ipAllowed, userAllowed] = await Promise.all([
    consumeRateLimit({
      limit: params.ipLimit,
      scope: `${params.scope}:ip`,
      subject: ipAddress,
      windowMs: params.windowMs,
    }),
    consumeRateLimit({
      limit: params.userLimit,
      scope: `${params.scope}:user`,
      subject: normalizedUserId,
      windowMs: params.windowMs,
    }),
  ]);

  return ipAllowed && userAllowed;
}

export async function enforceCompatMutationRateLimit(params: CompatMutationRateLimitParams) {
  const allowed = await ensureCompatMutationBudget(params);
  if (allowed) return null;
  return params.c.json({ error: params.message || DEFAULT_RATE_LIMIT_MESSAGE }, 429);
}
