import type { QueryClient } from "@tanstack/react-query";
import { getProfileContentProjectionKeys } from "../../../data/profile/profileProjectionKeys";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { removeProjectionItemIds } from "../../../data/projections/projections";
import { markProjectionStale } from "../../../data/projections/patchEnvelope";
import { refreshViewerPrivacySensitiveScreens } from "../../../data/projections/projectionRefresh";

function patchOverviewProfileField(
  queryClient: QueryClient,
  overviewKey: readonly unknown[],
  patch: Record<string, unknown>,
) {
  queryClient.setQueryData(overviewKey, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { profile?: Record<string, unknown> };
    return { ...row, profile: { ...(row.profile || {}), ...patch } };
  });
}

export function removeBlockedUserFromSettingsProjection(params: {
  blockedId: string;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  removeProjectionItemIds({
    entity: "blocked-users",
    ids: [params.blockedId],
    queryClient: params.queryClient,
    screenKey: projectionKeys.blockedUsers(params.viewerKey),
  });
}

export function applyViewerPrivacyCacheUpdate(params: {
  isPrivate: boolean;
  overviewKey: readonly unknown[];
  queryClient: QueryClient;
  username: string;
  viewerKey: string;
}) {
  patchOverviewProfileField(params.queryClient, params.overviewKey, {
    isPrivate: params.isPrivate,
  });
  markProjectionStale(params.queryClient, params.overviewKey);
  getProfileContentProjectionKeys(params.username, params.viewerKey).forEach((queryKey) => {
    markProjectionStale(params.queryClient, queryKey);
  });
}

export function applyViewerHideEmailCacheUpdate(params: {
  hideEmail: boolean;
  overviewKey: readonly unknown[];
  queryClient: QueryClient;
}) {
  patchOverviewProfileField(params.queryClient, params.overviewKey, {
    hideEmail: params.hideEmail,
  });
  markProjectionStale(params.queryClient, params.overviewKey);
}

export function refreshViewerPrivacyCaches(params: {
  queryClient: QueryClient;
  username: string;
  viewerKey: string;
}) {
  refreshViewerPrivacySensitiveScreens(params.queryClient, params.viewerKey, params.username);
}
