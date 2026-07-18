import type { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../projections/projectionKeys";
import {
  refreshViewerPrivacySensitiveScreens,
  replaceProjectionScope,
} from "../projections/projectionRefresh";
import { clearProjectionPrefetchRegistry } from "../projections/prefetch/prefetchRegistry";
import { invalidateProfileReadCaches } from "../profile/profileLookup";
import {
  invalidateViewerBlockedVisibility,
  loadViewerBlockedVisibilityOrEmpty,
} from "./blockedVisibility";
import { runBlockedActorIsolationHandlers } from "./clientIsolationRegistry";
import { removeBlockedRelationshipSurfaces } from "./relationshipCacheIsolation";

export async function applyBlockedClientIsolation(params: {
  isBlocked: boolean;
  queryClient: QueryClient;
  targetAccountType?: "club" | "student";
  targetUserId?: string | null;
  targetUsername?: string | null;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  invalidateProfileReadCaches({
    userId: params.targetUserId,
    usernames: [params.targetUsername, params.viewerUsername],
  });

  removeBlockedRelationshipSurfaces({
    queryClient: params.queryClient,
    targetAccountType: params.targetAccountType,
    targetUserId: params.targetUserId,
    targetUsername: params.targetUsername,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });

  if (params.isBlocked) {
    runBlockedActorIsolationHandlers({
      targetUserId: params.targetUserId,
      targetUsername: params.targetUsername,
      viewerKey: params.viewerCacheKey,
    });
  }

  clearProjectionPrefetchRegistry();
  invalidateViewerBlockedVisibility(params.viewerCacheKey);
  await loadViewerBlockedVisibilityOrEmpty(params.viewerCacheKey, {
    scope: "SOCIAL/ISOLATION",
    warningKey: "blocked-visibility-refresh-failed",
  });

  refreshViewerPrivacySensitiveScreens(
    params.queryClient,
    params.viewerCacheKey,
    params.targetUsername || undefined,
  );
  replaceProjectionScope(
    params.queryClient,
    projectionKeys.notifications(params.viewerCacheKey, "all"),
  );
  replaceProjectionScope(params.queryClient, projectionKeys.blockedUsers(params.viewerCacheKey));
}
