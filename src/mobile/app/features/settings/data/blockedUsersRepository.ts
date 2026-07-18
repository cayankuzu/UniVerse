/**
 * Blocked Users Repository — Single source of truth for blocked user data.
 *
 * DATA LAYER: Owns blocked users list query.
 *
 * Flow: ProjectionAPI → blockedUsersRepository → ViewModel → UI
 */
import type { ProjectionFetchContext } from "../../../data/projections/contracts";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type { BlockedUserProjectionItem } from "../../../data/projections/projections.types";
import type { ProjectionRequestContext } from "../../../data/projections/projections.request";
import { ProjectionAPI } from "../../../data/projections/projections.shared";
import { ReportAPI } from "../../../data/normalizers/reports";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { STALE_TIMES, INITIAL_PAGE_SIZES, PAGE_SIZES } from "../../../data/projections/cacheConfig";
import { BLOCKED_USERS_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import type { ViewerContext } from "../../../data/projections/viewerContext";

// ─── Fetch Functions ────────────────────────────────────────────────────────

export function fetchBlockedUsers(
  context: ProjectionRequestContext = {},
  viewerId?: string,
): Promise<ProjectionEnvelope<BlockedUserProjectionItem>> {
  return ProjectionAPI.getBlockedUsers(context, viewerId);
}

export function submitBlockedUserReport(user: BlockedUserProjectionItem) {
  return ReportAPI.submit({
    reason: "Engellenen kullanıcı şikâyeti",
    targetId: user.userId || user.username,
    targetType: "user",
    targetUsername: user.username,
  });
}

// ─── Query Definitions ──────────────────────────────────────────────────────

export function getBlockedUsersQueryDef(viewer: ViewerContext) {
  const viewerKey = getViewerKey(viewer);
  return {
    entity: "blocked-users" as const,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchBlockedUsers(
        {
          cursor,
          deltaToken,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.blockedUsers, INITIAL_PAGE_SIZES.blockedUsers)
              : (limit ?? PAGE_SIZES.blockedUsers),
          since,
        },
        viewer.id,
      ),
    pageSize: PAGE_SIZES.blockedUsers,
    policy: BLOCKED_USERS_PROJECTION_POLICY,
    queryKey: projectionKeys.blockedUsers(viewerKey),
    staleTime: STALE_TIMES.blockedUsers,
  };
}
