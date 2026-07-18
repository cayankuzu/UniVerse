export type ScreenSyncStage =
  "cache-first" | "refreshing" | "background-sync" | "empty" | "error" | "offline-degraded";

export interface StagedLoadState {
  canRenderContent: boolean;
  isBlocking: boolean;
  stage: ScreenSyncStage;
}

export function resolveStagedLoadState(params: {
  backgroundRefreshing?: boolean;
  error?: boolean;
  hasContent: boolean;
  isLoading?: boolean;
  offlineDegraded?: boolean;
  refreshing?: boolean;
}): StagedLoadState {
  if (params.offlineDegraded && params.hasContent) {
    return { canRenderContent: true, isBlocking: false, stage: "offline-degraded" };
  }
  if (params.refreshing && params.hasContent) {
    return { canRenderContent: true, isBlocking: false, stage: "refreshing" };
  }
  if (params.backgroundRefreshing && params.hasContent) {
    return { canRenderContent: true, isBlocking: false, stage: "background-sync" };
  }
  if (params.isLoading && !params.hasContent) {
    return { canRenderContent: false, isBlocking: true, stage: "cache-first" };
  }
  if (params.error && !params.hasContent) {
    return { canRenderContent: false, isBlocking: false, stage: "error" };
  }
  if (!params.hasContent) {
    return { canRenderContent: false, isBlocking: false, stage: "empty" };
  }
  return { canRenderContent: true, isBlocking: false, stage: "background-sync" };
}
