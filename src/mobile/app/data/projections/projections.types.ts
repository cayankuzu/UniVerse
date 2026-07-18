import type { ProjectionEnvelope } from "../../data/query/contracts";
import type { UserProfile } from "../contracts/entities";
import type {
  BlockedUserItem,
  FollowRequestItem,
  NotificationItem,
  SearchUserResult,
} from "../contracts/api";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import type { ProfileCapabilities } from "../profile/profileLookup";

export type FeedKind = "event" | "album";
export type FeedSource = "following" | "club" | "student" | "other" | "own";

interface FeedBase {
  id: string;
  source: FeedSource;
  sortDate: string;
}

export interface EventFeedItem extends FeedBase {
  kind: "event";
  event: EventWithMeta;
}

export interface AlbumFeedItem extends FeedBase {
  kind: "album";
  album: AlbumPhotoWithMeta;
}

export type FeedItem = EventFeedItem | AlbumFeedItem;

export type ProjectionHomeFeedItem = FeedItem & {
  actor: "club" | "student";
};

export interface NotificationBadgeProjection {
  id: string;
  unreadCount: number;
}

export interface RelationshipProjectionItem extends FollowRequestItem {
  id: string;
  isPrivate?: boolean;
  viewerFollowStatus?: "none" | "requested" | "following";
}

export type ProfileContentTab = "album" | "events";

export interface ProfileOverviewProjection {
  id: string;
  username: string;
  profile: UserProfile;
  capabilities: ProfileCapabilities | null;
  followStatus: "none" | "requested" | "following";
}

export interface ProfileScreenProjectionItem {
  id: string;
  username: string;
  overview: ProfileOverviewProjection;
  contentItems: unknown[];
}

export interface ProfileScreenProjectionResult<T> {
  overview: ProfileOverviewProjection;
  content: ProjectionEnvelope<T>;
}

export interface EventDetailProjection {
  albumCount: number;
  event: EventWithMeta;
  id: string;
}

export type AlbumEventProjectionItem = AlbumPhotoWithMeta;
export type SearchProjectionItem = EventWithMeta | AlbumPhotoWithMeta | SearchUserResult;

export type BlockedUserProjectionItem = BlockedUserItem & {
  id: string;
};

export interface HomeProjectionParams {
  blockedUsernames?: string[];
  entityFilter?: "all" | "clubs" | "students";
  sortOption?: "newest" | "oldest";
  sourceFilter?: "all" | "following" | "own";
  typeFilter?: "all" | "events" | "albums";
  viewerAccountType?: "club" | "student";
  viewerId?: string;
  viewerUsername: string;
}

export interface SearchProjectionParams {
  categoryFilter?: string;
  feeFilter?: "" | "free" | "paid";
  kind: "albums" | "events" | "clubs" | "students";
  limit?: number;
  queryText?: string;
  sortMode?: string;
  universityFilter?: string;
  viewerId?: string;
  viewerUsername?: string;
}

export interface AppWarmupSearchBundle {
  content: ProjectionEnvelope<SearchProjectionItem>;
  kind: SearchProjectionParams["kind"];
  params: {
    categoryFilter?: string;
    feeFilter?: SearchProjectionParams["feeFilter"];
    queryText?: string;
    sortMode?: string;
    universityFilter?: string;
  };
  scope: string;
}

export type AppWarmupSearchDiscoveryBundle = Record<
  SearchProjectionParams["kind"],
  ProjectionEnvelope<SearchProjectionItem>
>;

export interface AppWarmupBundle {
  generatedAt: string;
  home: ProjectionEnvelope<ProjectionHomeFeedItem>;
  homeScope: string;
  notificationBadge: NotificationBadgeProjection;
  notifications: ProjectionEnvelope<NotificationItem>;
  profileAlbums: ProjectionEnvelope<AlbumPhotoWithMeta>;
  profileEvents: ProjectionEnvelope<EventWithMeta>;
  profileOverview: ProfileOverviewProjection;
  profileUsername: string;
  source: "fallback" | "rpc" | "timeout-backpressure";
  searchDiscovery: AppWarmupSearchDiscoveryBundle;
  search: AppWarmupSearchBundle | null;
}
