import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import type { ProjectionFreshnessPolicy } from "../../../data/projections/policies/projectionFreshness";
import { createStableQueryOptions } from "../../../data/query/options";
import { fetchProfileScreenBootstrap } from "../data";
import {
  readProfileBootstrapSeedState,
  seedProfileBootstrapCache,
  shouldBootstrapProfileScreen,
} from "./profileBootstrapCache";

interface UseProfileScreenBootstrapOptions {
  enabled: boolean;
  pageSize?: number;
  tab: ProfileContentTab;
  username: string;
  viewerId?: string | null;
  viewerKey: string;
  viewerUsername: string;
  policy?: Partial<ProjectionFreshnessPolicy>;
}

export function useProfileBootstrapState({
  enabled,
  pageSize = PAGE_SIZES.profileContent,
  tab,
  username,
  viewerId,
  viewerKey,
  viewerUsername,
  policy: _policy,
}: UseProfileScreenBootstrapOptions) {
  const queryClient = useQueryClient();
  const bootstrapIdentity = `${viewerKey}:${username}`;
  const [bootstrappedIdentity, setBootstrappedIdentity] = useState("");
  const seedState = useMemo(
    () =>
      readProfileBootstrapSeedState({
        queryClient,
        tab,
        username,
        viewerKey,
      }),
    [queryClient, tab, username, viewerKey],
  );
  const shouldBootstrap = shouldBootstrapProfileScreen({
    bootstrapIdentity,
    bootstrappedIdentity,
    enabled,
    hasContentSeed: seedState.hasContentSeed,
    hasOverviewSeed: seedState.hasOverviewSeed,
    username,
  });

  useEffect(() => {
    setBootstrappedIdentity("");
  }, [bootstrapIdentity]);

  const bootstrapQuery = useQuery({
    ...createStableQueryOptions(8_000),
    enabled: shouldBootstrap,
    placeholderData: (previousData) => previousData,
    queryFn: () =>
      fetchProfileScreenBootstrap({
        pageSize,
        tab,
        username,
        viewerId: viewerId || undefined,
        viewerUsername,
      }),
    queryKey: seedState.screenKey,
  });

  useEffect(() => {
    if (!bootstrapQuery.data) return;
    seedProfileBootstrapCache({
      contentKey: seedState.contentKey,
      overviewKey: seedState.overviewKey,
      queryClient,
      result: bootstrapQuery.data,
      tab,
    });
    setBootstrappedIdentity(bootstrapIdentity);
  }, [
    bootstrapIdentity,
    bootstrapQuery.data,
    queryClient,
    seedState.contentKey,
    seedState.overviewKey,
    tab,
  ]);

  useEffect(() => {
    if (!bootstrapQuery.error) return;
    setBootstrappedIdentity(bootstrapIdentity);
  }, [bootstrapIdentity, bootstrapQuery.error]);

  return {
    bootstrapQuery,
    isBootstrapping: shouldBootstrap,
  };
}
