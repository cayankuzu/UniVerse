import { useMemo } from "react";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import { PROFILE_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import type { ProfileTab } from "../domain/profileConstants";
import { getOwnProfileContentQueryDef, type AlbumPhotoWithMeta, type EventWithMeta } from "../data";
import { useProfileBootstrapState } from "./useProfileBootstrapState";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";
import { useOwnProfileOverviewState } from "./useOwnProfileOverviewState";

type UseOwnProfileProjectionStateParams = {
  accountType: "club" | "student";
  contentTab: ProfileContentTab;
  profileTab: ProfileTab;
  profileUsername: string;
  userData: AuthUserData;
  viewerKey: string;
};

export function useOwnProfileProjectionState(params: UseOwnProfileProjectionStateParams) {
  const profileEnabled = Boolean(params.profileUsername);
  const viewer = useMemo(
    () => ({ id: params.userData.id, username: params.profileUsername }),
    [params.profileUsername, params.userData.id],
  );
  const profileBootstrap = useProfileBootstrapState({
    enabled: profileEnabled,
    pageSize: PAGE_SIZES.profileContent,
    policy: PROFILE_PROJECTION_POLICY,
    tab: params.contentTab,
    username: params.profileUsername,
    viewerId: params.userData.id,
    viewerKey: params.viewerKey,
    viewerUsername: params.profileUsername,
  });
  const contentDef = useMemo(
    () =>
      getOwnProfileContentQueryDef({
        tab: params.contentTab,
        viewer,
      }),
    [params.contentTab, viewer],
  );
  const overviewState = useOwnProfileOverviewState({
    accountType: params.accountType,
    enabled: profileEnabled,
    isBootstrapping: profileBootstrap.isBootstrapping,
    profileUsername: params.profileUsername,
    userData: params.userData,
  });
  const shouldFetchContent = profileEnabled && !profileBootstrap.isBootstrapping;
  const activeProjection = useProjectionScreen<AlbumPhotoWithMeta | EventWithMeta>({
    ...contentDef,
    autoRefreshOnFocus: false,
    enabled: shouldFetchContent,
  });
  const profileContent = useProfileProjectionContentState({
    activeItems: activeProjection.items,
    enabled: profileEnabled,
    expectedAlbumsCount: overviewState.expectedAlbumsCount,
    expectedEventsCount: overviewState.expectedEventsCount,
    tab: params.contentTab,
    username: params.profileUsername,
    viewerId: params.userData.id || undefined,
    viewerKey: params.viewerKey,
    viewerUsername: params.profileUsername,
  });
  const onRefresh = useScreenRefresh({
    enabled: true,
    maxParallel: 2,
    screenKey: `profile:${params.viewerKey}:${params.profileUsername}:${params.contentTab}`,
    surface: "profile",
    tasks: [
      {
        bestEffort: true,
        id: "profile-overview",
        lane: "background",
        run: () => overviewState.overviewQuery.refetch(),
      },
      {
        id: "profile-content",
        run: () => (shouldFetchContent ? activeProjection.onRefresh() : undefined),
      },
    ],
  });

  return {
    activeProjection,
    loadingMore: activeProjection.loadingMore,
    onRefresh,
    overviewQuery: overviewState.overviewQuery,
    profileBootstrap,
    profileTab: params.profileTab,
    refreshing: shouldFetchContent
      ? activeProjection.refreshing
      : Boolean(overviewState.overviewQuery.isFetching),
    resolvedAccountType: overviewState.resolvedAccountType,
    resolvedProfile: overviewState.resolvedProfile,
    resolvedUserData: overviewState.resolvedUserData,
    sourceAlbums: profileContent.sourceAlbums,
    sourceEvents: profileContent.sourceEvents,
  };
}
