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

  const filterRowsForViewer = async <T extends { id?: string; userId?: string }>(
    viewerId: string,
    rows: T[],
  ) => {
    const normalizedViewerId = normalizeUserId(viewerId);
    if (!normalizedViewerId || !Array.isArray(rows) || rows.length === 0) {
      return Array.isArray(rows) ? rows : [];
    }

    const viewerBlocked = await getBlockedSet(normalizedViewerId);
    const candidateTargetIds = Array.from(
      new Set(
        rows
          .map((row) => normalizeUserId(row?.userId || row?.id))
          .filter(Boolean)
          .filter((targetId) => !viewerBlocked.has(targetId)),
      ),
    );

    const targetBlockedMap = new Map<string, Set<string>>();
    await Promise.all(
      candidateTargetIds.map(async (targetId) => {
        targetBlockedMap.set(targetId, await getBlockedSet(targetId));
      }),
    );

    return rows.filter((row) => {
      const targetId = normalizeUserId(row?.userId || row?.id);
      if (!targetId) return false;
      if (viewerBlocked.has(targetId)) return false;
      return !targetBlockedMap.get(targetId)?.has(normalizedViewerId);
    });
  };

  return {
    filterRowsForViewer,
    getBlockDirection,
    getBlockedSet,
    isBlockedPair,
  };
}
