import type { ProjectionEnvelope } from "../../../data/query/contracts";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { AlbumAPI, EventAPI } from "../../../data/content";
import { recordSecurityTelemetryEvent } from "../../../platform/security/securityTelemetry";
import { nowEnvelope, tryProjectionRpc } from "../../../data/projections/projections.api.helpers";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedAlbums,
  filterBlockedEvents,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../../data/social/blockedVisibility";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "../../../data/projections/projections.request";
import type {
  ProfileContentTab,
  ProfileOverviewProjection,
  ProfileScreenProjectionItem,
  ProfileScreenProjectionResult,
  RelationshipProjectionItem,
} from "../../../data/projections/projections.types";
import { normalizeProjectionValue } from "../../../data/projections/projections.common";
import { getProfileOverviewProjection } from "../../../data/profile/profileOverviewProjection";
import {
  mergeProfileEventEnvelopeWithLocalShadow,
  mapProfileAlbumEnvelope,
  mapProfileEventEnvelope,
} from "./profileProjectionApi.helpers";
import { getRelationshipsProjection } from "./profileRelationshipsProjection";

type BlockedVisibilitySnapshot = ReturnType<typeof createEmptyBlockedVisibilitySnapshot>;
type ProfileAlbumFilterOptions = {
  preserveViewerOwned?: boolean;
  viewerId?: string;
  viewerUsername?: string;
};
type ProfileContentRuntime = {
  albumFilterOptions?: ProfileAlbumFilterOptions;
  allowLocalProfileShadow: boolean;
  blockedVisibility: BlockedVisibilitySnapshot;
  username: string;
};

async function resolveBlockedVisibility(viewerId?: string) {
  return loadViewerBlockedVisibilityOrEmpty(viewerId, {
    scope: "PROFILE/PROJECTION",
    warningKey: "profile-blocked-visibility-load-failed",
  });
}

function shouldAllowProfileLocalShadow(targetUsername: string, viewerUsername?: string) {
  const normalizedTarget = normalizeProjectionValue(targetUsername);
  const normalizedViewer = normalizeProjectionValue(viewerUsername || "");
  return Boolean(normalizedTarget && normalizedTarget === normalizedViewer);
}

function buildProfileAlbumFilterOptions(params: {
  targetUsername: string;
  viewerId?: string;
  viewerUsername?: string;
}) {
  const normalizedTarget = normalizeProjectionValue(params.targetUsername);
  const normalizedViewer = normalizeProjectionValue(params.viewerUsername || "");
  if (!normalizedTarget || !normalizedViewer || normalizedTarget !== normalizedViewer) {
    return undefined;
  }

  return {
    preserveViewerOwned: true,
    viewerId: params.viewerId,
    viewerUsername: normalizedViewer,
  };
}

function filterProfileContentEnvelope(
  tab: ProfileContentTab,
  envelope: ProjectionEnvelope<unknown>,
  blockedVisibility: BlockedVisibilitySnapshot,
  options?: ProfileAlbumFilterOptions,
) {
  if (tab === "album") {
    const items = (envelope.items || []) as AlbumPhotoWithMeta[];
    const updatedItems = (envelope.updatedItems || []) as AlbumPhotoWithMeta[];
    return {
      ...envelope,
      items: filterBlockedAlbums(items, blockedVisibility, options),
      updatedItems: filterBlockedAlbums(updatedItems, blockedVisibility, options),
    };
  }
  if (tab === "events") {
    const items = (envelope.items || []) as EventWithMeta[];
    const updatedItems = (envelope.updatedItems || []) as EventWithMeta[];
    return {
      ...envelope,
      items: filterBlockedEvents(items, blockedVisibility),
      updatedItems: filterBlockedEvents(updatedItems, blockedVisibility),
    };
  }
  return envelope;
}

async function createProfileContentRuntime(params: {
  targetUsername: string;
  viewerId?: string;
  viewerUsername?: string;
}): Promise<ProfileContentRuntime> {
  const username = normalizeProjectionValue(params.targetUsername);
  const viewerUsername = normalizeProjectionValue(params.viewerUsername || "");
  return {
    albumFilterOptions: buildProfileAlbumFilterOptions({
      targetUsername: username,
      viewerId: params.viewerId,
      viewerUsername,
    }),
    allowLocalProfileShadow: shouldAllowProfileLocalShadow(username, viewerUsername),
    blockedVisibility: await resolveBlockedVisibility(params.viewerId),
    username,
  };
}

async function mapProfileContentEnvelope(params: {
  envelope: ProjectionEnvelope<unknown>;
  recoverEmpty: boolean;
  runtime: ProfileContentRuntime;
  tab: ProfileContentTab;
}) {
  const { runtime, tab } = params;
  const { albumFilterOptions, allowLocalProfileShadow, blockedVisibility } = runtime;
  if (tab === "album") {
    return filterProfileContentEnvelope(
      tab,
      await mapProfileAlbumEnvelope({
        envelope: params.envelope,
        recoverEmpty: params.recoverEmpty,
        username: runtime.username,
      }),
      blockedVisibility,
      albumFilterOptions,
    );
  }
  if (tab === "events") {
    return filterProfileContentEnvelope(
      tab,
      await mapProfileEventEnvelope({
        allowLocalShadow: allowLocalProfileShadow,
        envelope: params.envelope,
        recoverEmpty: params.recoverEmpty,
        username: runtime.username,
      }),
      blockedVisibility,
      albumFilterOptions,
    );
  }
  return filterProfileContentEnvelope(tab, params.envelope, blockedVisibility, albumFilterOptions);
}

async function buildProfileContentFallbackEnvelope(params: {
  runtime: ProfileContentRuntime;
  tab: ProfileContentTab;
}) {
  const { runtime, tab } = params;
  const { albumFilterOptions, allowLocalProfileShadow, blockedVisibility } = runtime;
  if (tab === "album") {
    return filterProfileContentEnvelope(
      tab,
      nowEnvelope(await AlbumAPI.getPhotos(runtime.username)),
      blockedVisibility,
      albumFilterOptions,
    );
  }
  if (tab === "events") {
    return filterProfileContentEnvelope(
      tab,
      await mergeProfileEventEnvelopeWithLocalShadow(
        runtime.username,
        nowEnvelope(await EventAPI.getProfileEvents(runtime.username)),
        { allowLocalShadow: allowLocalProfileShadow },
      ),
      blockedVisibility,
      albumFilterOptions,
    );
  }
  return nowEnvelope([]);
}

async function getProfileContentEnvelope(params: {
  context?: ProjectionRequestContext;
  runtime: ProfileContentRuntime;
  tab: ProfileContentTab;
  viewerId?: string;
}) {
  const resolvedContext = params.context || {};
  const rpcEnvelope = await tryProjectionRpc<unknown>("profile_content_projection", {
    cursor: resolvedContext.cursor || null,
    ...resolveProjectionDeltaParams(resolvedContext),
    limit_count: clampProjectionLimit(resolvedContext.limit, 33),
    tab_name: params.tab,
    target_username: params.runtime.username,
    viewer_id: params.viewerId || null,
  });

  if (!rpcEnvelope) {
    return buildProfileContentFallbackEnvelope({
      runtime: params.runtime,
      tab: params.tab,
    });
  }

  return mapProfileContentEnvelope({
    envelope: rpcEnvelope,
    recoverEmpty: false,
    runtime: params.runtime,
    tab: params.tab,
  });
}

export async function getProfileOverview(
  username: string,
  viewerUsername: string,
  viewerId?: string,
): Promise<ProfileOverviewProjection> {
  return getProfileOverviewProjection(username, viewerUsername, viewerId);
}

export async function getProfileContent(
  username: string,
  tab: ProfileContentTab,
  viewerId?: string,
  viewerUsernameOrContext?: string | ProjectionRequestContext,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>> {
  const viewerUsername =
    typeof viewerUsernameOrContext === "string" ? viewerUsernameOrContext : undefined;
  const resolvedContext =
    typeof viewerUsernameOrContext === "string" ? context : viewerUsernameOrContext || context;
  const runtime = await createProfileContentRuntime({
    targetUsername: username,
    viewerId,
    viewerUsername,
  });
  return getProfileContentEnvelope({
    context: resolvedContext,
    runtime,
    tab,
    viewerId,
  }) as Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>>;
}

export async function getProfileScreen<T>(
  username: string,
  viewerUsername: string,
  tab: ProfileContentTab,
  viewerId?: string,
  context: ProjectionRequestContext = {},
): Promise<ProfileScreenProjectionResult<T>> {
  const normalizedUsername = normalizeProjectionValue(username);
  const normalizedViewer = normalizeProjectionValue(viewerUsername);
  try {
    const contentRuntimePromise = createProfileContentRuntime({
      targetUsername: normalizedUsername,
      viewerId,
      viewerUsername: normalizedViewer,
    });
    const rpcEnvelope = await tryProjectionRpc<ProfileScreenProjectionItem>(
      "profile_screen_projection",
      {
        cursor: context.cursor || null,
        ...resolveProjectionDeltaParams(context),
        limit_count: clampProjectionLimit(context.limit, 33),
        tab_name: tab,
        target_username: normalizedUsername,
        viewer_id: viewerId || null,
      },
    );
    const firstItem = rpcEnvelope?.items?.[0];
    if (rpcEnvelope && firstItem?.overview) {
      const overviewProfile = firstItem.overview?.profile as
        | {
            albumsCount?: number;
            eventsCount?: number;
          }
        | undefined;
      const contentItems = firstItem.contentItems || [];
      const isInitialBootstrap = !context.cursor && !context.deltaToken && !context.since;
      const shouldRecoverEmpty =
        tab === "album"
          ? isInitialBootstrap &&
            (contentItems.length === 0 || Number(overviewProfile?.albumsCount || 0) > 0)
          : tab === "events"
            ? isInitialBootstrap &&
              (contentItems.length === 0 || Number(overviewProfile?.eventsCount || 0) > 0)
            : false;
      const contentEnvelopeBase: ProjectionEnvelope<unknown> = {
        deletedIds: rpcEnvelope.deletedIds || [],
        deltaToken: rpcEnvelope.deltaToken || null,
        items: contentItems,
        nextCursor: rpcEnvelope.nextCursor || null,
        serverTime: rpcEnvelope.serverTime,
        updatedItems: [],
      };
      const mappedContent = await mapProfileContentEnvelope({
        envelope: contentEnvelopeBase,
        recoverEmpty: shouldRecoverEmpty,
        runtime: await contentRuntimePromise,
        tab,
      });
      recordSecurityTelemetryEvent({
        action: "profile.access",
        meta: { source: "projection_rpc", tab },
        resourceId: normalizedUsername,
        resourceType: "profile",
        result: "success",
      });
      return {
        overview: firstItem.overview,
        content: mappedContent as ProjectionEnvelope<T>,
      };
    }

    const [overview, content] = await Promise.all([
      getProfileOverview(normalizedUsername, normalizedViewer, viewerId),
      getProfileContentEnvelope({
        context,
        runtime: await contentRuntimePromise,
        tab,
        viewerId,
      }) as Promise<ProjectionEnvelope<T>>,
    ]);
    recordSecurityTelemetryEvent({
      action: "profile.access",
      meta: { source: "fallback_read", tab },
      resourceId: normalizedUsername,
      resourceType: "profile",
      result: "success",
    });
    return {
      overview,
      content,
    };
  } catch (error) {
    recordSecurityTelemetryEvent({
      action: "profile.access",
      meta: {
        message: String((error as { message?: string } | null)?.message || "profile-access-failed"),
        tab,
      },
      resourceId: normalizedUsername,
      resourceType: "profile",
      result: "fail",
    });
    throw error;
  }
}

export function getRelationships(
  username: string,
  kind: "followers" | "following",
  viewerId?: string,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<RelationshipProjectionItem>> {
  return getRelationshipsProjection({
    context,
    kind,
    username: normalizeProjectionValue(username),
    viewerId,
  });
}
