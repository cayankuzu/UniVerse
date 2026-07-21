import type { ProfileOverviewProjection } from "../projections/projections.types";
import { AuthAPI } from "../auth";
import { tryProjectionRpc } from "../projections/projections.api.helpers";
import { normalizeProjectionValue } from "../projections/projections.common";
import { FollowAPI } from "../social";
import { getProfileCapabilities } from "./profileLookup";
import { loadProfileMetrics } from "./profileMetrics";
import { ProfileAPI } from "./profiles.api";

function isBlockedProfileOverview(
  overview: Pick<ProfileOverviewProjection, "capabilities"> | null | undefined,
) {
  const capabilities = overview?.capabilities;
  if (!capabilities) return false;
  if (capabilities.canViewHeader === false) return true;
  return (
    capabilities.lockedReasonCode === "BLOCKED" ||
    capabilities.lockedReasonCode === "BLOCKED_BY_VIEWER"
  );
}

export async function getProfileOverviewProjection(
  username: string,
  viewerUsername: string,
  viewerId?: string,
  signal?: AbortSignal,
): Promise<ProfileOverviewProjection> {
  const normalizedUsername = normalizeProjectionValue(username);
  const normalizedViewer = normalizeProjectionValue(viewerUsername);
  const rpcArgs = {
    since: null,
    target_username: normalizedUsername,
    viewer_id: viewerId || null,
  };
  const rpcEnvelope = signal
    ? await tryProjectionRpc<ProfileOverviewProjection>(
        "profile_overview_projection",
        rpcArgs,
        signal,
      )
    : await tryProjectionRpc<ProfileOverviewProjection>("profile_overview_projection", rpcArgs);
  if (rpcEnvelope?.items?.[0]) {
    if (isBlockedProfileOverview(rpcEnvelope.items[0])) {
      throw new Error("PROFILE_BLOCKED");
    }
    return rpcEnvelope.items[0];
  }

  const profile =
    normalizedUsername === normalizedViewer
      ? await AuthAPI.getMe({
          allowHardSignOut: false,
          includeMetrics: true,
          recoverSessionOnUnauthorized: false,
        })
      : await ProfileAPI.getByUsername(normalizedUsername);
  const targetUserId = String(profile.id || "").trim() || null;
  const [capabilities, followStatus, metrics] = await Promise.all([
    targetUserId ? getProfileCapabilities(targetUserId) : Promise.resolve(null),
    normalizedUsername === normalizedViewer
      ? Promise.resolve({ status: "none" as const })
      : FollowAPI.getStatus(normalizedUsername),
    normalizedUsername === normalizedViewer || !targetUserId
      ? Promise.resolve(null)
      : loadProfileMetrics(targetUserId).catch(() => null),
  ]);
  const hydratedProfile = metrics
    ? {
        ...profile,
        albumsCount: metrics.albumsCount,
        eventsCount: metrics.eventsCount,
        followersCount: metrics.followersCount,
        followingCount: metrics.followingCount,
      }
    : profile;

  return {
    capabilities,
    followStatus: followStatus.status,
    id: normalizedUsername || String(profile.id || ""),
    profile: hydratedProfile,
    username: normalizedUsername || profile.username,
  } as ProfileOverviewProjection;
}
