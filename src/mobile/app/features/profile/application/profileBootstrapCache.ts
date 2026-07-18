import type { QueryClient } from "@tanstack/react-query";
import type {
  ProfileContentTab,
  ProfileOverviewProjection,
} from "../../../data/projections/projections.types";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { applyProjectionEnvelope, getProjectionState } from "../../../data/projections/projections";
import { getProfileContentEntity } from "./profileCollections";

export function shouldBootstrapProfileScreen(params: {
  bootstrapIdentity: string;
  bootstrappedIdentity: string;
  enabled: boolean;
  hasContentSeed: boolean;
  hasOverviewSeed: boolean;
  username: string;
}) {
  return (
    params.enabled &&
    Boolean(params.username) &&
    params.bootstrappedIdentity !== params.bootstrapIdentity &&
    (!params.hasOverviewSeed || !params.hasContentSeed)
  );
}

function shouldClearBootstrapContent(overview: unknown) {
  const projection = overview as {
    capabilities?: {
      canViewContent?: boolean | null;
    } | null;
  } | null;
  return projection?.capabilities?.canViewContent === false;
}

export function readProfileBootstrapSeedState(params: {
  queryClient: QueryClient;
  tab: ProfileContentTab;
  username: string;
  viewerKey: string;
}) {
  const overviewKey = projectionKeys.profileOverview(params.username, params.viewerKey);
  const contentKey = projectionKeys.profileContent(params.username, params.tab, params.viewerKey);
  const screenKey = projectionKeys.profileScreen(params.username, params.tab, params.viewerKey);

  return {
    contentKey,
    hasContentSeed: Boolean(getProjectionState(params.queryClient, contentKey)),
    hasOverviewSeed: Boolean(
      params.queryClient.getQueryData<ProfileOverviewProjection>(overviewKey),
    ),
    overviewKey,
    screenKey,
  };
}

function getExpectedProfileContentCount(result: { overview: unknown; tab: ProfileContentTab }) {
  const overview = result.overview as {
    profile?: {
      albumsCount?: number | null;
      eventsCount?: number | null;
    } | null;
  } | null;
  const profile = overview?.profile;
  if (!profile) return 0;
  if (result.tab === "album") {
    return Math.max(0, Number(profile.albumsCount || 0));
  }
  return Math.max(0, Number(profile.eventsCount || 0));
}

function shouldSeedBootstrapContent(params: {
  result: {
    content: {
      items: Array<{ id?: string }>;
      updatedItems?: Array<{ id?: string }>;
    };
    overview: unknown;
  };
  tab: ProfileContentTab;
}) {
  const expectedCount = getExpectedProfileContentCount({
    overview: params.result.overview,
    tab: params.tab,
  });
  const resolvedItemCount =
    (params.result.content.items?.length || 0) + (params.result.content.updatedItems?.length || 0);
  return expectedCount <= 0 || resolvedItemCount > 0;
}

export function seedProfileBootstrapCache(params: {
  contentKey: readonly unknown[];
  overviewKey: readonly unknown[];
  queryClient: QueryClient;
  result: {
    content: {
      deletedIds?: string[];
      deltaToken?: string | null;
      items: Array<{ id?: string }>;
      nextCursor: string | null;
      serverTime: string;
      updatedItems?: Array<{ id?: string }>;
    };
    overview: unknown;
  };
  tab: ProfileContentTab;
}) {
  params.queryClient.setQueryData(params.overviewKey, params.result.overview);
  if (shouldClearBootstrapContent(params.result.overview)) {
    params.queryClient.removeQueries({ exact: true, queryKey: params.contentKey });
    return;
  }
  if (!shouldSeedBootstrapContent({ result: params.result, tab: params.tab })) {
    const existingContentState = getProjectionState(params.queryClient, params.contentKey);
    if (!existingContentState?.ids?.length) {
      params.queryClient.removeQueries({ exact: true, queryKey: params.contentKey });
    }
    return;
  }
  applyProjectionEnvelope({
    entity: getProfileContentEntity(params.tab),
    envelope: params.result.content,
    mode: "replace",
    queryClient: params.queryClient,
    screenKey: params.contentKey,
  });
}
