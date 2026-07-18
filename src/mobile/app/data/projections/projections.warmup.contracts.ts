import type { NotificationItem } from "../contracts/api";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import type { ProjectionEnvelope } from "../query/contracts";
import type { RelationshipSnapshotProjection } from "../social/relationshipSnapshot";
import { STARTUP_PERFORMANCE_BUDGET } from "./performanceBudget";
import type {
  HomeProjectionParams,
  NotificationBadgeProjection,
  ProfileOverviewProjection,
  ProjectionHomeFeedItem,
  SearchProjectionItem,
  SearchProjectionParams,
} from "./projections.types";

export const HOME_WARMUP_LIMIT = STARTUP_PERFORMANCE_BUDGET.firstFoldHomeLimit;
export const NOTIFICATIONS_WARMUP_LIMIT = 6;
export const WARMUP_PROJECTION_RPC_TIMEOUT_MS = STARTUP_PERFORMANCE_BUDGET.warmupRpcTimeoutMs;
export const FALLBACK_RPC_TIMEOUT_MS = 1_500;
export const WARMUP_RPC_TIMEOUT = Symbol("warmup-rpc-timeout");

export interface WarmupDelegates {
  getHomeFeed: (
    params: HomeProjectionParams,
    context?: { limit?: number },
  ) => Promise<ProjectionEnvelope<ProjectionHomeFeedItem>>;
  getNotificationBadge: (viewerId?: string) => Promise<NotificationBadgeProjection>;
  getNotifications: (
    filter: string,
    viewerId?: string,
    context?: { limit?: number },
  ) => Promise<ProjectionEnvelope<NotificationItem>>;
  getProfileContent: (
    username: string,
    tab: "album" | "events",
    viewerId?: string,
    context?: { limit?: number },
  ) => Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>>;
  getProfileOverview: (
    username: string,
    viewerUsername: string,
    viewerId?: string,
  ) => Promise<ProfileOverviewProjection>;
  getSearchResults: (
    params: SearchProjectionParams,
    context?: { limit?: number },
  ) => Promise<ProjectionEnvelope<SearchProjectionItem>>;
  getViewerRelationshipSnapshot: (params: {
    viewerId?: string;
    viewerUsername?: string;
  }) => Promise<RelationshipSnapshotProjection>;
}

export type WarmupBundleParams = {
  home?: {
    entityFilter?: HomeProjectionParams["entityFilter"];
    scope: string;
    sortOption?: HomeProjectionParams["sortOption"];
    sourceFilter?: HomeProjectionParams["sourceFilter"];
    typeFilter?: HomeProjectionParams["typeFilter"];
  } | null;
  search?: {
    categoryFilter?: string;
    feeFilter?: SearchProjectionParams["feeFilter"];
    kind: SearchProjectionParams["kind"];
    queryText?: string;
    scope: string;
    sortMode?: string;
    universityFilter?: string;
  } | null;
  skipHomeBadgeInFallback?: boolean;
  viewerAccountType?: "club" | "student";
  viewerId?: string;
  viewerUsername: string;
};
