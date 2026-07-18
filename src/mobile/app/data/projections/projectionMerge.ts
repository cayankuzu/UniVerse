export type ProjectionMergeMode = "replace" | "append" | "delta";

export interface ProjectionScreenState {
  ids: string[];
  nextCursor: string | null;
  serverTime: string | null;
  deltaToken: string | null;
  forceRefreshMode?: ProjectionMergeMode | null;
  touchedAt: number;
  isStale?: boolean;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function mergeProjectionIds(params: {
  currentIds: string[];
  nextIds: string[];
  updatedIds?: string[];
  deletedIds?: string[];
  mode: ProjectionMergeMode;
}) {
  const deletedSet = new Set(
    (params.deletedIds || []).map((item) => String(item || "").trim()).filter(Boolean),
  );
  const currentIds = params.currentIds.filter((item) => !deletedSet.has(item));
  const nextIds = uniqueIds(params.nextIds.filter((item) => !deletedSet.has(item)));
  const updatedIds = uniqueIds((params.updatedIds || []).filter((item) => !deletedSet.has(item)));

  if (params.mode === "replace") {
    return nextIds;
  }
  if (params.mode === "append") {
    return uniqueIds([...currentIds, ...nextIds]);
  }

  return uniqueIds([...updatedIds, ...nextIds, ...currentIds]);
}

export function createProjectionScreenState(params: {
  ids: string[];
  nextCursor: string | null;
  serverTime: string | null;
  deltaToken?: string | null;
  forceRefreshMode?: ProjectionMergeMode | null;
  isStale?: boolean;
}) {
  return {
    ids: params.ids,
    nextCursor: params.nextCursor,
    serverTime: params.serverTime,
    deltaToken: params.deltaToken ?? null,
    forceRefreshMode: params.forceRefreshMode ?? null,
    touchedAt: Date.now(),
    isStale: params.isStale ?? false,
  } satisfies ProjectionScreenState;
}
