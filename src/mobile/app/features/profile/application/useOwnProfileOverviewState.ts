import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createStableQueryOptions } from "../../../data/query/options";
import type { AuthUserData } from "../../../data/contracts/entities";
import { buildResolvedProfileUserData, getOwnProfileOverviewQueryDef } from "../data";

type UseOwnProfileOverviewStateParams = {
  accountType: "club" | "student";
  enabled: boolean;
  isBootstrapping: boolean;
  profileUsername: string;
  userData: AuthUserData;
};

export function useOwnProfileOverviewState(params: UseOwnProfileOverviewStateParams) {
  const { userData } = params;
  const overviewDef = useMemo(
    () =>
      getOwnProfileOverviewQueryDef({
        id: params.userData.id,
        username: params.profileUsername,
      }),
    [params.profileUsername, params.userData.id],
  );
  const overviewQuery = useQuery({
    ...createStableQueryOptions(overviewDef.staleTime),
    enabled: params.enabled && !params.isBootstrapping,
    placeholderData: (previousData) => previousData,
    queryFn: overviewDef.queryFn,
    queryKey: overviewDef.queryKey,
  });
  const resolvedProfile = overviewQuery.data?.profile;
  const resolvedUserData = useMemo(
    () => buildResolvedProfileUserData(userData, resolvedProfile) as AuthUserData,
    [resolvedProfile, userData],
  );
  const resolvedAccountType =
    resolvedProfile?.accountType === "club" || resolvedProfile?.accountType === "student"
      ? resolvedProfile.accountType
      : params.accountType;

  return {
    expectedAlbumsCount: Number(resolvedProfile?.albumsCount || 0),
    expectedEventsCount: Number(resolvedProfile?.eventsCount || 0),
    overviewQuery,
    resolvedAccountType,
    resolvedProfile,
    resolvedUserData,
  };
}
