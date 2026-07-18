import type { SupabaseClient } from "npm:@supabase/supabase-js";

const SQL_BLOCKED_STATE_TTL_MS = 15_000;

type ViewerBlockedSnapshotRow = {
  user_id?: string | null;
  userId?: string | null;
};

type CachedBlockedState = {
  blockedIds: Set<string>;
  expiresAt: number;
};

const blockedStateCache = new Map<string, CachedBlockedState>();

function normalizeUserId(value: unknown) {
  return String(value || "").trim();
}

export function invalidateSqlBlockedActorSet(viewerId?: string | null) {
  const normalizedViewerId = normalizeUserId(viewerId);
  if (!normalizedViewerId) {
    blockedStateCache.clear();
    return;
  }
  blockedStateCache.delete(normalizedViewerId);
}

export async function loadSqlBlockedActorSet(adminSupabase: SupabaseClient, viewerId: string) {
  const normalizedViewerId = normalizeUserId(viewerId);
  if (!normalizedViewerId) return new Set<string>();

  const cached = blockedStateCache.get(normalizedViewerId);
  if (cached && cached.expiresAt > Date.now()) {
    return new Set(cached.blockedIds);
  }

  const { data, error } = await adminSupabase.rpc("viewer_blocked_snapshot", {
    viewer_id: normalizedViewerId,
  });

  const blockedIds = new Set<string>();
  if (!error && Array.isArray(data)) {
    data.forEach((row) => {
      const userId = normalizeUserId(
        (row as ViewerBlockedSnapshotRow | null)?.user_id ||
          (row as ViewerBlockedSnapshotRow | null)?.userId,
      );
      if (userId) blockedIds.add(userId);
    });
  }

  blockedStateCache.set(normalizedViewerId, {
    blockedIds,
    expiresAt: Date.now() + SQL_BLOCKED_STATE_TTL_MS,
  });
  return new Set(blockedIds);
}

export async function isSqlBlockedPair(adminSupabase: SupabaseClient, a: string, b: string) {
  const normalizedA = normalizeUserId(a);
  const normalizedB = normalizeUserId(b);
  if (!normalizedA || !normalizedB || normalizedA === normalizedB) return false;
  const blockedIds = await loadSqlBlockedActorSet(adminSupabase, normalizedA);
  return blockedIds.has(normalizedB);
}
