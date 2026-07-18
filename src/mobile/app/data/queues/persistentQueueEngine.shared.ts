import type { PersistentQueueEntryBase } from "./persistentQueueEngine.contracts";

export function normalizeAttemptCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export function normalizeMaxAttempts(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function normalizeDateString(value: unknown, fallback: string) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

export function normalizeOwnerId(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

export function getNowIsoString() {
  return new Date().toISOString();
}

export function shouldProcessEntryNow<Kind extends string, Status extends string>(
  entry: PersistentQueueEntryBase<Kind, Status>,
  nowMs: number,
) {
  const nextProcessAt = String(entry.nextProcessAt || "").trim();
  if (!nextProcessAt) return true;
  const nextProcessAtMs = new Date(nextProcessAt).getTime();
  if (!Number.isFinite(nextProcessAtMs)) return true;
  return nextProcessAtMs <= nowMs;
}
