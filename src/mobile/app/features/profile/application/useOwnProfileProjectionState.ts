import { useMemo } from "react";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import { PROFILE_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import type { AuthUserData } from "../../../data/contracts/entities";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import type { ProfileTab } from "../domain/profileConstants";
import { getOwnProfileContentQueryDef } from "../data";
import { useProfileBootstrapState } from "./useProfileBootstrapState";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";
import { useProfileContentProjections } from "./useProfileContentProjections";
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
    tab: "album",
    username: params.profileUsername,
    viewerId: params.userData.id,
    viewerKey: params.viewerKey,
    viewerUsername: params.profileUsername,
  });
  const albumContentDef = useMemo(
    () =>
      getOwnProfileContentQueryDef({
        tab: "album",
        viewer,
      }),
    [viewer],
  );
  const eventContentDef = useMemo(
    () =>
      getOwnProfileContentQueryDef({
        tab: "events",
        viewer,
      }),
    [viewer],
  );
  const overviewState = useOwnProfileOverviewState({
    accountType: params.accountType,
    enabled: profileEnabled,
    isBootstrapping: profileBootstrap.isBootstrapping,
    profileUsername: params.profileUsername,
    userData: params.userData,
  });
  const shouldFetchContent = profileEnabled && !profileBootstrap.isBootstrapping;
  const { activeProjection, albumProjection, eventProjection } = useProfileContentProjections({
    albumDef: albumContentDef,
    enabled: shouldFetchContent,
    eventDef: eventContentDef,
    tab: params.contentTab,
  });
  const profileContent = useProfileProjectionContentState({
    albumItems: albumProjection.items,
    enabled: profileEnabled,
    eventItems: eventProjection.items,
  });
  const onRefresh = useScreenRefresh({
    enabled: true,
    maxParallel: 2,
    screenKey: `profile:${params.viewerKey}:${params.profileUsername}`,
    surface: "profile",
    tasks: [
      {
        bestEffort: true,
        id: "profile-overview",
        lane: "background",
        run: () => overviewState.overviewQuery.refetch(),
      },
      {
        id: "profile-albums",
        run: () => (shouldFetchContent ? albumProjection.onRefresh() : undefined),
      },
      {
        id: "profile-events",
        run: () => (shouldFetchContent ? eventProjection.onRefresh() : undefined),
      },
    ],
  });

  return {
    activeProjection,
    albumProjection,
    eventProjection,
    loadingMore: activeProjection.loadingMore,
    onRefresh,
    overviewQuery: overviewState.overviewQuery,
    profileBootstrap,
    profileTab: params.profileTab,
    refreshing: shouldFetchContent
      ? albumProjection.refreshing || eventProjection.refreshing
      : Boolean(overviewState.overviewQuery.isFetching),
    resolvedAccountType: overviewState.resolvedAccountType,
    resolvedProfile: overviewState.resolvedProfile,
    resolvedUserData: overviewState.resolvedUserData,
    sourceAlbums: profileContent.sourceAlbums,
    sourceEvents: profileContent.sourceEvents,
  };
}
