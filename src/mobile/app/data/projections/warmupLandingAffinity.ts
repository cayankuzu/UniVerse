export const WARMUP_LANDING_SURFACES = ["search", "profile", "notifications"] as const;

export type WarmupLandingSurface = (typeof WARMUP_LANDING_SURFACES)[number];
type WarmupDayPart = "afternoon" | "evening" | "morning" | "night";
type LandingScores = Record<WarmupLandingSurface, number>;

export interface PersistedLandingAffinity {
  dayPartScores: Record<WarmupDayPart, LandingScores>;
  lastSurface: WarmupLandingSurface | null;
  scores: LandingScores;
  updatedAt: string;
}

const MAX_SCORE = 100;
const SCORE_DECAY_PER_DAY = 0.86;
const DAY_PART_WEIGHT = 1.6;
const LAST_SURFACE_BONUS = 0.8;
const LAST_SURFACE_BONUS_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

function createEmptyLandingScores(): LandingScores {
  return {
    notifications: 0,
    profile: 0,
    search: 0,
  };
}

export function createEmptyLandingAffinity(): PersistedLandingAffinity {
  return {
    dayPartScores: {
      afternoon: createEmptyLandingScores(),
      evening: createEmptyLandingScores(),
      morning: createEmptyLandingScores(),
      night: createEmptyLandingScores(),
    },
    lastSurface: null,
    scores: createEmptyLandingScores(),
    updatedAt: new Date(0).toISOString(),
  };
}

function isWarmupLandingSurface(value: unknown): value is WarmupLandingSurface {
  return WARMUP_LANDING_SURFACES.includes(value as WarmupLandingSurface);
}

function sanitizeScore(value: unknown) {
  const score = Number(value || 0);
  if (!Number.isFinite(score)) return 0;
  return Math.min(MAX_SCORE, Math.max(0, score));
}

function sanitizeLandingScores(value: unknown): LandingScores {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    notifications: sanitizeScore(record.notifications),
    profile: sanitizeScore(record.profile),
    search: sanitizeScore(record.search),
  };
}

function resolveWarmupDayPart(date: Date): WarmupDayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "night";
}

export function parseLandingAffinity(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PersistedLandingAffinity> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const dayPartScores =
      parsed.dayPartScores && typeof parsed.dayPartScores === "object"
        ? parsed.dayPartScores
        : createEmptyLandingAffinity().dayPartScores;
    const updatedAtMs = Date.parse(String(parsed.updatedAt || ""));
    return {
      dayPartScores: {
        afternoon: sanitizeLandingScores(dayPartScores.afternoon),
        evening: sanitizeLandingScores(dayPartScores.evening),
        morning: sanitizeLandingScores(dayPartScores.morning),
        night: sanitizeLandingScores(dayPartScores.night),
      },
      lastSurface: isWarmupLandingSurface(parsed.lastSurface) ? parsed.lastSurface : null,
      scores: sanitizeLandingScores(parsed.scores),
      updatedAt: Number.isFinite(updatedAtMs)
        ? new Date(updatedAtMs).toISOString()
        : new Date(0).toISOString(),
    } satisfies PersistedLandingAffinity;
  } catch {
    return null;
  }
}

function decayScores(scores: LandingScores, decayFactor: number) {
  return WARMUP_LANDING_SURFACES.reduce<LandingScores>((nextScores, surface) => {
    nextScores[surface] = sanitizeScore(scores[surface] * decayFactor);
    return nextScores;
  }, createEmptyLandingScores());
}

export function recordLandingAffinityVisit(
  current: PersistedLandingAffinity | null | undefined,
  surface: WarmupLandingSurface,
  now = new Date(),
) {
  const affinity = current || createEmptyLandingAffinity();
  const previousUpdatedAt = Date.parse(affinity.updatedAt);
  const elapsedDays = Number.isFinite(previousUpdatedAt)
    ? Math.max(0, now.getTime() - previousUpdatedAt) / (24 * 60 * 60_000)
    : 0;
  const decayFactor = Math.pow(SCORE_DECAY_PER_DAY, Math.min(30, elapsedDays));
  const dayPart = resolveWarmupDayPart(now);
  const scores = decayScores(affinity.scores, decayFactor);
  const dayPartScores = {
    afternoon: decayScores(affinity.dayPartScores.afternoon, decayFactor),
    evening: decayScores(affinity.dayPartScores.evening, decayFactor),
    morning: decayScores(affinity.dayPartScores.morning, decayFactor),
    night: decayScores(affinity.dayPartScores.night, decayFactor),
  };
  scores[surface] = sanitizeScore(scores[surface] + 1);
  dayPartScores[dayPart][surface] = sanitizeScore(dayPartScores[dayPart][surface] + 1);

  return {
    dayPartScores,
    lastSurface: surface,
    scores,
    updatedAt: now.toISOString(),
  } satisfies PersistedLandingAffinity;
}

export function rankWarmupLandingSurfaces(
  affinity: PersistedLandingAffinity | null | undefined,
  now = new Date(),
) {
  if (!affinity) return [...WARMUP_LANDING_SURFACES];
  const dayPartScores = affinity.dayPartScores[resolveWarmupDayPart(now)];
  const updatedAt = Date.parse(affinity.updatedAt);
  const lastSurfaceIsRecent =
    Boolean(affinity.lastSurface) &&
    Number.isFinite(updatedAt) &&
    now.getTime() - updatedAt <= LAST_SURFACE_BONUS_MAX_AGE_MS;

  return [...WARMUP_LANDING_SURFACES].sort((left, right) => {
    const score = (surface: WarmupLandingSurface) =>
      affinity.scores[surface] +
      dayPartScores[surface] * DAY_PART_WEIGHT +
      (lastSurfaceIsRecent && affinity.lastSurface === surface ? LAST_SURFACE_BONUS : 0);
    const scoreDifference = score(right) - score(left);
    if (scoreDifference !== 0) return scoreDifference;
    return WARMUP_LANDING_SURFACES.indexOf(left) - WARMUP_LANDING_SURFACES.indexOf(right);
  });
}
