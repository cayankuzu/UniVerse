function clampIndex(length: number, index: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function normalizeViewerRelationKey(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function prepareViewerData<T extends { id: string }>(params: {
  data: T[];
  initialIndex: number;
  initialItemId?: string | null;
}) {
  const targetItemId = String(params.initialItemId || "").trim();
  if (targetItemId) {
    const matchedIndex = params.data.findIndex((item) => item.id === targetItemId);
    if (matchedIndex >= 0) {
      return {
        data: params.data,
        initialIndex: matchedIndex,
      };
    }
  }

  return {
    data: params.data,
    initialIndex: clampIndex(params.data.length, params.initialIndex),
  };
}

export function resolveViewerInitialIndex<T extends { id: string }>(params: {
  data: T[];
  initialIndex: number;
  initialItemId?: string | null;
}) {
  return prepareViewerData(params).initialIndex;
}

export function resolveViewerListInstanceKey(params: {
  initialIndex: number;
  initialItemId?: string | null;
  listType: "albums" | "events";
  totalItems: number;
}) {
  const targetItemId = String(params.initialItemId || "").trim();
  const stableTarget = targetItemId || `index:${params.initialIndex}`;
  return `${params.listType}:${stableTarget}:count:${params.totalItems}`;
}
