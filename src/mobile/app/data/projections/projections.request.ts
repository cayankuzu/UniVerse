export interface ProjectionRequestContext {
  cursor?: string | null;
  deltaToken?: string | null;
  limit?: number;
  since?: string | null;
}

export function clampProjectionLimit(
  value: number | null | undefined,
  fallback: number,
  min = 1,
  max = 50,
) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}

export function isProjectionUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

export function resolveProjectionDeltaParams(
  context: Pick<ProjectionRequestContext, "deltaToken" | "since">,
) {
  return {
    delta_token: String(context.deltaToken || "").trim() || null,
    since: context.since || null,
  };
}
