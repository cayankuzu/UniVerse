import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  ProjectionHomeFeedItem,
  SearchProjectionItem,
} from "../projections/projections.types";
import { createProjectionScreenState } from "../projections/projectionMerge";
import { projectionKeys } from "../projections/projectionKeys";
import { getProjectionState } from "../projections/projections";
import { patchDiscoverySnapshotFollowState } from "../projections/discoverySnapshotCache";
import type { RelationshipSnapshotProjection } from "./relationshipSnapshot";

export type RelationshipTargetAccountType = "club" | "student";

function clampCount(value: number) {
  return Math.max(0, value);
}

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function upsertUsername(list: string[] | undefined, username: string) {
  const normalizedTarget = normalize(username);
  const next = new Set((list || []).map((item) => normalize(item)).filter(Boolean));
  if (normalizedTarget) next.add(normalizedTarget);
  return Array.from(next);
}

function removeUsername(list: string[] | undefined, username: string) {
  const normalizedTarget = normalize(username);
  return (list || [])
    .map((item) => normalize(item))
    .filter((item) => item && item !== normalizedTarget);
}

function trim(value: string | null | undefined) {
  return String(value || "").trim();
}

function removeProjectionId(queryClient: QueryClient, queryKey: QueryKey, id: string) {
  queryClient.setQueryData(queryKey, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { ids?: string[] };
    if (!Array.isArray(row.ids)) return current;
    return {
      ...row,
      ids: row.ids.filter((item) => item !== id),
      touchedAt: Date.now(),
    };
  });
}

function patchProjectionScreenIds<T>(params: {
  entity: string;
  predicate: (item: T) => boolean;
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  params.queryClient.getQueriesData({ queryKey: params.queryKey }).forEach(([screenKey]) => {
    const current = getProjectionState(params.queryClient, screenKey);
    if (!current?.ids?.length) return;
    const nextIds = current.ids.filter((id) => {
      const item = params.queryClient.getQueryData(projectionKeys.entity(params.entity, id)) as
        T | undefined;
      return item ? params.predicate(item) : true;
    });
    if (nextIds.length === current.ids.length) return;
    params.queryClient.setQueryData(
      screenKey,
      createProjectionScreenState({
        deltaToken: current.deltaToken,
        ids: nextIds,
        isStale: current.isStale,
        nextCursor: current.nextCursor,
        serverTime: current.serverTime,
      }),
    );
  });
}

function matchesHomeFollowTarget(
  item: ProjectionHomeFeedItem,
  targetUsername: string,
  targetAccountType?: RelationshipTargetAccountType,
) {
  const normalizedTarget = normalize(targetUsername);
  if (!normalizedTarget || item.source !== "following") return false;

  if (item.kind === "event") {
    if (targetAccountType === "student") {
      return normalize(item.event.feedActorUsername || "") === normalizedTarget;
    }
    return normalize(item.event.clubUsername || "") === normalizedTarget;
  }

  if (targetAccountType === "student") {
    return normalize(item.album.username || "") === normalizedTarget;
  }
  return (
    normalize(item.album.clubUsername || "") === normalizedTarget ||
    normalize(item.album.username || "") === normalizedTarget
  );
}

function matchesSearchFollowTarget(
  item: SearchProjectionItem,
  targetUsername: string,
  targetAccountType?: RelationshipTargetAccountType,
) {
  const normalizedTarget = normalize(targetUsername);
  if (!normalizedTarget || !item || typeof item !== "object") return false;

  if ("eventId" in item) {
    return normalize(String(item.username || "")) === normalizedTarget;
  }

  if ("clubUsername" in item) {
    if (targetAccountType === "student") {
      return normalize(String(item.feedActorUsername || "")) === normalizedTarget;
    }
    return normalize(String(item.clubUsername || "")) === normalizedTarget;
  }

  return false;
}

function patchViewerRelationshipSnapshot(params: {
  nextStatus: "none" | "requested" | "following";
  queryClient: QueryClient;
  targetAccountType?: RelationshipTargetAccountType;
  targetIsPrivate?: boolean | null;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  const normalizedUsername = normalize(params.username);
  const normalizedViewerCacheKey = normalize(params.viewerCacheKey);
  const normalizedViewerUsername = normalize(params.viewerUsername);
  if (!normalizedUsername) return;

  params.queryClient.setQueriesData(
    {
      queryKey: ["social", "relations", "snapshot"],
    },
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const snapshot = current as RelationshipSnapshotProjection;
      const snapshotViewerId = normalize(snapshot.viewerId || snapshot.id || "");
      const snapshotViewerUsername = normalize(snapshot.viewerUsername || "");
      const matchesViewer =
        (!snapshotViewerId && !snapshotViewerUsername) ||
        snapshotViewerId === normalizedViewerCacheKey ||
        snapshotViewerUsername === normalizedViewerUsername;
      if (!matchesViewer) return current;

      const existingRows = Array.isArray(snapshot.following) ? snapshot.following : [];
      const nextRows = existingRows.filter((row) => normalize(row.username) !== normalizedUsername);
      if (params.nextStatus === "following") {
        nextRows.push({
          accountType: params.targetAccountType === "club" ? "club" : "student",
          isPrivate: params.targetAccountType === "club" ? false : Boolean(params.targetIsPrivate),
          username: normalizedUsername,
        });
      }

      return {
        ...snapshot,
        following: nextRows,
        followingClubUsernames:
          params.targetAccountType === "club"
            ? params.nextStatus === "following"
              ? upsertUsername(snapshot.followingClubUsernames, normalizedUsername)
              : removeUsername(snapshot.followingClubUsernames, normalizedUsername)
            : removeUsername(snapshot.followingClubUsernames, normalizedUsername),
        followingStudentUsernames:
          params.targetAccountType === "student"
            ? params.nextStatus === "following"
              ? upsertUsername(snapshot.followingStudentUsernames, normalizedUsername)
              : removeUsername(snapshot.followingStudentUsernames, normalizedUsername)
            : removeUsername(snapshot.followingStudentUsernames, normalizedUsername),
        followingUsernames:
          params.nextStatus === "following"
            ? upsertUsername(snapshot.followingUsernames, normalizedUsername)
            : removeUsername(snapshot.followingUsernames, normalizedUsername),
        id: snapshot.id || normalizedViewerCacheKey || normalizedViewerUsername || "guest",
        viewerId: snapshot.viewerId || normalizedViewerCacheKey,
        viewerUsername: snapshot.viewerUsername || normalizedViewerUsername,
      };
    },
  );
}

export function patchViewerRelationshipSurfaces(params: {
  nextStatus: "none" | "requested" | "following";
  queryClient: QueryClient;
  targetAccountType?: RelationshipTargetAccountType;
  targetIsPrivate?: boolean | null;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  const normalizedUsername = normalize(params.username);
  if (!normalizedUsername) return;

  patchViewerRelationshipSnapshot({
    nextStatus: params.nextStatus,
    queryClient: params.queryClient,
    targetAccountType: params.targetAccountType,
    targetIsPrivate: params.targetIsPrivate,
    username: normalizedUsername,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });

  patchDiscoverySnapshotFollowState({
    nextStatus: params.nextStatus,
    queryClient: params.queryClient,
    targetAccountType: params.targetAccountType,
    targetIsPrivate: params.targetIsPrivate,
    username: normalizedUsername,
    viewerCacheKey: params.viewerCacheKey,
  });

  if (params.nextStatus !== "following") {
    patchProjectionScreenIds<ProjectionHomeFeedItem>({
      entity: "home-feed",
      predicate: (item) =>
        !matchesHomeFollowTarget(item, normalizedUsername, params.targetAccountType),
      queryClient: params.queryClient,
      queryKey: projectionKeys.screen("home", params.viewerCacheKey),
    });
  }

  if (params.nextStatus === "following" || params.nextStatus === "requested") {
    patchProjectionScreenIds<SearchProjectionItem>({
      entity: "search-events",
      predicate: (item) =>
        !matchesSearchFollowTarget(item, normalizedUsername, params.targetAccountType),
      queryClient: params.queryClient,
      queryKey: projectionKeys.screen("search", "events", params.viewerCacheKey),
    });
    patchProjectionScreenIds<SearchProjectionItem>({
      entity: "search-albums",
      predicate: (item) =>
        !matchesSearchFollowTarget(item, normalizedUsername, params.targetAccountType),
      queryClient: params.queryClient,
      queryKey: projectionKeys.screen("search", "albums", params.viewerCacheKey),
    });
  }
}

export function removeBlockedRelationshipSurfaces(params: {
  queryClient: QueryClient;
  targetAccountType?: RelationshipTargetAccountType;
  targetUserId?: string | null;
  targetUsername?: string | null;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  const targetUserId = trim(params.targetUserId);
  const targetUsername = normalize(params.targetUsername || "");
  const viewerId = trim(params.viewerCacheKey);
  const viewerUsername = normalize(params.viewerUsername);

  if (targetUserId && viewerUsername) {
    removeProjectionId(
      params.queryClient,
      projectionKeys.relationships(viewerUsername, "followers", params.viewerCacheKey),
      targetUserId,
    );
    removeProjectionId(
      params.queryClient,
      projectionKeys.relationships(viewerUsername, "following", params.viewerCacheKey),
      targetUserId,
    );
  }

  if (viewerId && targetUsername) {
    removeProjectionId(
      params.queryClient,
      projectionKeys.relationships(targetUsername, "followers", params.viewerCacheKey),
      viewerId,
    );
    removeProjectionId(
      params.queryClient,
      projectionKeys.relationships(targetUsername, "following", params.viewerCacheKey),
      viewerId,
    );
  }

  if (!targetUsername) return;

  params.queryClient.setQueryData(
    projectionKeys.profileOverview(targetUsername, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as { followStatus?: string; profile?: Record<string, unknown> };
      if (!row.profile) return current;
      return {
        ...row,
        followStatus: "none",
        profile: {
          ...row.profile,
          followersCount: clampCount(Number(row.profile.followersCount || 0) - 1),
          followingCount: clampCount(Number(row.profile.followingCount || 0) - 1),
        },
      };
    },
  );
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(viewerUsername, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as { profile?: Record<string, unknown> };
      if (!row.profile) return current;
      return {
        ...row,
        profile: {
          ...row.profile,
          followersCount: clampCount(Number(row.profile.followersCount || 0) - 1),
          followingCount: clampCount(Number(row.profile.followingCount || 0) - 1),
        },
      };
    },
  );

  patchViewerRelationshipSurfaces({
    nextStatus: "none",
    queryClient: params.queryClient,
    targetAccountType: params.targetAccountType,
    username: targetUsername,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });
}
