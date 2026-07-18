import { QUERY_CACHE_MAX_AGE } from "../../../data/query/persist";

export const MAX_HOME_STARTUP_PREVIEW_AGE_MS = QUERY_CACHE_MAX_AGE;

export function shouldUseHomeStartupPreview(params: {
  hasProjectionContent: boolean;
  startupPreviewItemsLength: number;
  startupSnapshotSavedAt?: number | null;
}) {
  if (params.hasProjectionContent || params.startupPreviewItemsLength <= 0) {
    return false;
  }

  const savedAt = Number(params.startupSnapshotSavedAt || 0);
  if (savedAt <= 0) {
    return false;
  }

  return Date.now() - savedAt <= MAX_HOME_STARTUP_PREVIEW_AGE_MS;
}
