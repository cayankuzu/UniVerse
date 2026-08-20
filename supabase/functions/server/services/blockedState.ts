import type { KvBlockedRecord } from "../types.ts";

type BlockedStateReaderDeps = {
  loadBlockedRows: (userId: string) => Promise<KvBlockedRecord[]>;
};

function normalizeUserId(value: unknown) {
  return String(value || "").trim();
}

export function createBlockedStateReader(deps: BlockedStateReaderDeps) {
  const blockedCache = new Map<string, Set<string>>();

  const getBlockedSet = async (userId: string) => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return new Set<string>();

    const cached = blockedCache.get(normalizedUserId);
    if (cached) return cached;

    const rows = await deps.loadBlockedRows(normalizedUserId);
    const blockedSet = new Set(rows.map((item) => normalizeUserId(item?.userId)).filter(Boolean));
    blockedCache.set(normalizedUserId, blockedSet);
    return blockedSet;
  };

  const getBlockDirection = async (viewerId: string, targetId: string) => {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetId = normalizeUserId(targetId);
    if (!normalizedViewerId || !normalizedTargetId || normalizedViewerId === normalizedTargetId) {
      return {
        targetBlockedViewer: false,
        viewerBlockedTarget: false,
      };
    }

    const [viewerBlocked, targetBlocked] = await Promise.all([
      getBlockedSet(normalizedViewerId),
      getBlockedSet(normalizedTargetId),
    ]);

    return {
      targetBlockedViewer: targetBlocked.has(normalizedViewerId),
      viewerBlockedTarget: viewerBlocked.has(normalizedTargetId),
    };
  };

  const isBlockedPair = async (viewerId: string, targetId: string) => {
    const { targetBlockedViewer, viewerBlockedTarget } = await getBlockDirection(
      viewerId,
      targetId,
    );
    return targetBlockedViewer || viewerBlockedTarget;
  };

  const filterRowsByTargetId = async <T>(
    viewerId: string,
    rows: T[],
    getTargetId: (row: T) => string,
  ) => {
    const normalizedViewerId = normalizeUserId(viewerId);
    if (!normalizedViewerId || rows.length === 0) return rows;

    const viewerBlocked = await getBlockedSet(normalizedViewerId);
    const targetIds = Array.from(
      new Set(rows.map((row) => normalizeUserId(getTargetId(row))).filter(Boolean)),
    ).filter((targetId) => !viewerBlocked.has(targetId));
    const targetBlockedEntries = await Promise.all(
      targetIds.map(async (targetId) => [targetId, await getBlockedSet(targetId)] as const),
    );
    const targetBlockedMap = new Map(targetBlockedEntries);

    return rows.filter((row) => {
      const targetId = normalizeUserId(getTargetId(row));
      if (!targetId || viewerBlocked.has(targetId)) return false;
      return !targetBlockedMap.get(targetId)?.has(normalizedViewerId);
    });
  };

  const filterRowsForViewer = async <T extends { id?: string; userId?: string }>(
    viewerId: string,
    rows: T[],
  ) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return Array.isArray(rows) ? rows : [];
    }
    return filterRowsByTargetId(viewerId, rows, (row) => row?.userId || row?.id || "");
  };

  return {
    filterRowsForViewer,
    filterRowsByTargetId,
    getBlockDirection,
    getBlockedSet,
    isBlockedPair,
  };
}
