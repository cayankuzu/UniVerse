export type AccountType = "student" | "club";

export interface ImageVariants {
  thumbnail?: string;
  medium?: string;
  full?: string;
}

export type FollowStatus = "none" | "following" | "requested";

export type EventVisibility = "public" | "members_only";

export type NotificationType =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "like"
  | "comment"
  | "event"
  | "join"
  | "join_request"
  | "join_accepted"
  | "join_rejected"
  | "system";

export interface FollowStatusResponse {
  status: FollowStatus;
}

export interface LikeResponse {
  liked: boolean;
  count: number;
}

export interface AttendResponse {
  joined: boolean;
  count: number;
}

export interface SuccessResponse {
  success: boolean;
}

export interface SearchUserResult {
  id: string;
  username: string;
  name: string;
  image: string;
  imageVariants?: ImageVariants;
  coverImage: string;
  coverImageVariants?: ImageVariants;
  university: string;
  isPrivate: boolean;
  accountType?: AccountType;
  createdAt?: string;
  department?: string;
  year?: string;
  category?: string;
  categories?: string[];
  description?: string;
  bio?: string;
}

export interface CommentItem {
  id: string;
  userId: string;
  username: string;
  name: string;
  image: string;
  imageVariants?: ImageVariants;
  university?: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  time: string;
  likesCount?: number;
  likedByViewer?: boolean;
}

export interface FollowRequestItem {
  username: string;
  name: string;
  image: string;
  imageVariants?: ImageVariants;
  coverImage?: string;
  coverImageVariants?: ImageVariants;
  university?: string;
  accountType: AccountType;
  department?: string;
  year?: string;
  category?: string;
  categories?: string[];
  description?: string;
  bio?: string;
  time: string;
}

export interface BlockedUserItem {
  userId: string;
  username: string;
  name: string;
  image: string;
  imageVariants?: ImageVariants;
  university?: string;
  accountType?: AccountType;
  isPrivate?: boolean;
  blockedAt?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  fromUserId: string;
  fromUsername: string;
  fromName: string;
  fromImage: string;
  fromImageVariants?: ImageVariants;
  message: string;
  detail?: string;
  contentTitle?: string;
  contentSubtitle?: string;
  eventTitle?: string;
  eventId?: string;
  photoId?: string;
  targetType: "event" | "profile" | "album";
  read: boolean;
  requestStatus?: "pending" | "accepted" | "rejected";
  requestResolvedAt?: string;
  createdAt: string;
  time: string;
}

export interface ReportPayload {
  targetType: "event" | "user" | "album" | "event_comment" | "album_comment";
  targetId: string;
  targetUsername?: string;
  reason: string;
  detail?: string;
}
