import type { QueryClient } from "@tanstack/react-query";
import type { AuthUserData } from "../../../data/contracts/entities";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { normalizeUsername } from "./authHelpers";

type ViewerIdentity = Pick<AuthUserData, "id" | "username">;

type ApplyAuthViewerCachePolicyParams = {
  currentUserData: AuthUserData;
  isLoggedIn: boolean;
  nextUserData: AuthUserData;
  repairedViewerCacheKey: string;
};

export function resolveViewerCacheKey(identity: ViewerIdentity) {
  return getViewerKey(identity);
}

function sumProfileCounts(userData: AuthUserData) {
  return (
    Number(userData.followers || 0) +
    Number(userData.following || 0) +
    Number(userData.albums || 0) +
    Number(userData.events || 0)
  );
}

export function applyAuthViewerCachePolicy(
  queryClient: QueryClient,
  params: ApplyAuthViewerCachePolicyParams,
) {
  const previousViewerKey = resolveViewerCacheKey(params.currentUserData);
  const viewerKey = resolveViewerCacheKey(params.nextUserData);

  // Initial hydration: transitioning from default state (guest) to the real
  // user. The warmup pipeline has already seeded projection data into cache —
  // wiping it here would force a full re-fetch and add seconds to startup.
  const isInitialHydration = previousViewerKey === "guest" && viewerKey !== "guest";

  const previousProfileCountsTotal = sumProfileCounts(params.currentUserData);
  const nextProfileCountsTotal = sumProfileCounts(params.nextUserData);
  // Only recover zero-state when we previously HAD real profile data (from
  // a successful API response during this session) but now the API returns
  // zero counts — that signals genuine corruption.
  // The old `||` condition fired on every startup because session restore
  // provides zero counts (minimal session data), destroying warmup caches.
  const shouldRecoverZeroStateCache =
    !isInitialHydration &&
    previousViewerKey === viewerKey &&
    viewerKey !== "guest" &&
    params.repairedViewerCacheKey !== viewerKey &&
    previousProfileCountsTotal > 0 &&
    nextProfileCountsTotal === 0;
  const shouldResetViewerCache =
    !isInitialHydration &&
    (!params.isLoggedIn ||
      previousViewerKey !== viewerKey ||
      normalizeUsername(params.currentUserData.username) !==
        normalizeUsername(params.nextUserData.username) ||
      shouldRecoverZeroStateCache);

  if (shouldResetViewerCache) {
    void queryClient;
  }

  return {
    nextRepairedViewerCacheKey:
      previousViewerKey !== viewerKey
        ? ""
        : shouldRecoverZeroStateCache
          ? viewerKey
          : params.repairedViewerCacheKey,
    viewerKey,
  };
}
