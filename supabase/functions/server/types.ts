import type { Context, Hono } from "npm:hono";
import type { SupabaseClient } from "npm:@supabase/supabase-js";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | undefined | JsonValue[] | { [key: string]: JsonValue };

export type EdgeUser = {
  email?: string | null;
  id: string;
  user_metadata?: Record<string, unknown>;
};

export type KvProfileRecord = {
  accountType: "club" | "student";
  bio?: string;
  categories: string[];
  clubName?: string;
  coverImage?: string;
  createdAt?: string;
  department?: string;
  description?: string;
  email: string;
  gradeYear?: string;
  hideEmail?: boolean;
  id: string;
  isPrivate?: boolean;
  name?: string;
  profileImage?: string;
  university: string;
  username: string;
};

export type KvNotificationRecord = {
  createdAt: string;
  detail?: string;
  eventId?: string;
  eventTitle?: string;
  fromImage?: string;
  fromName?: string;
  fromUserId?: string;
  fromUsername?: string;
  id: string;
  message: string;
  photoId?: string;
  read: boolean;
  targetProfileId?: string;
  targetType?: string;
  type: string;
};

export type KvBlockedRecord = {
  accountType?: "club" | "student";
  blockedAt?: string;
  image?: string;
  isPrivate?: boolean;
  name?: string;
  university?: string;
  userId: string;
  username?: string;
};

export type KvFollowRecord = {
  accountType?: "club" | "student";
  createdAt?: string;
  image?: string;
  name?: string;
  fromUserId?: string;
  sentAt?: string;
  toUserId?: string;
  toUsername?: string;
  university?: string;
  userId?: string;
  username?: string;
};

export type KvFollowRequestRecord = {
  fromAccountType?: "club" | "student";
  fromImage?: string;
  fromName?: string;
  fromUserId?: string;
  fromUsername?: string;
  sentAt?: string;
  toUserId?: string;
  toUsername?: string;
};

export type KvEventRecord = {
  access?: string;
  access_label?: string;
  address?: string;
  capacity?: number | null;
  categories?: string[];
  category?: string;
  club?: string;
  clubImage?: string;
  clubUserId?: string;
  clubUsername?: string;
  createdAt?: string;
  date?: string;
  description?: string;
  ends_at?: string;
  endDate?: string;
  endTime?: string;
  event_type?: string;
  fee?: string;
  fee_label?: string;
  id: string;
  image?: string;
  isCancelled?: boolean;
  is_cancelled?: boolean;
  level?: string;
  location?: string;
  location_name?: string;
  materials?: string;
  startDate?: string;
  startTime?: string;
  starts_at?: string;
  targetAudience?: string;
  target_audience?: string;
  title?: string;
  type?: string;
  university?: string;
  visibility?: string;
};

export type KvCommentRecord = {
  createdAt: string;
  id: string;
  image?: string;
  name?: string;
  parentId?: string | null;
  text?: string;
  userId: string;
  username?: string;
};

export type KvAlbumPhotoRecord = {
  caption?: string;
  createdAt?: string;
  eventId?: string;
  event_id?: string;
  eventTitle?: string;
  id: string;
  image?: string;
  images?: string[];
  media_paths?: string[];
  showOnClubProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnProfile?: boolean;
  storagePath?: string;
  storage_path?: string;
  title?: string;
  userImage?: string;
  userUniversity?: string;
  userId?: string;
  username?: string;
  name?: string;
};

export type KvReportRecord = {
  createdAt: string;
  detail?: string;
  fromUserId: string;
  fromUsername?: string;
  id: string;
  reason: string;
  targetId: string;
  targetType: string;
  targetUsername?: string;
};

export type KvBooleanRecord = Record<string, boolean>;

export type EnrichedKvEventRecord = KvEventRecord & {
  attendees: number;
  comments: number;
  joined: boolean;
  liked: boolean;
  likes: number;
};

export type NotificationInsertPayload = Omit<KvNotificationRecord, "createdAt" | "id" | "read">;

export type EdgeRouteApp = Hono;
export type EdgeRouteContext = Context;

export type ServerRouteDeps = {
  addNotification: (userId: string, data: NotificationInsertPayload) => Promise<void>;
  adminSupabase: SupabaseClient;
  buildUserDeletionContext: (userId: string) => Promise<{
    accountType?: string;
    preservedAlbums?: Array<{ eventTitle: string; photoId: string }>;
    storagePaths: string[];
  }>;
  enrichEvent: (event: KvEventRecord, userId: string) => Promise<EnrichedKvEventRecord>;
  filterBlockedRowsForViewer: <T extends { id?: string; userId?: string }>(
    viewerId: string,
    rows: T[],
  ) => Promise<T[]>;
  generateId: () => string;
  getUser: (c: EdgeRouteContext) => Promise<EdgeUser | null>;
  isKvBlockedPair: (a: string, b: string) => Promise<boolean>;
  loadCanonicalProfile: (user: EdgeUser) => Promise<KvProfileRecord | null>;
  migrateClubUsernameDependencies: (
    userId: string,
    previousUsername: string,
    nextUsername: string,
  ) => Promise<void>;
  normalizeEmail: (value: string) => string;
  normalizeUsername: (value: string) => string;
  persistProfile: (
    payload: KvProfileRecord & { userId: string; email: string; username: string },
  ) => Promise<KvProfileRecord>;
  purgeUserAccountData: (
    userId: string,
    context?: {
      accountType?: string;
      preservedAlbums?: Array<{ eventTitle: string; photoId: string }>;
      storagePaths: string[];
    } | null,
  ) => Promise<void>;
  syncClubEventProfileFields: (profile: KvProfileRecord) => Promise<void>;
  syncProfileToTable: (profile: KvProfileRecord) => Promise<KvProfileRecord>;
  timeAgo: (isoDate: string) => string;
  USERNAME_REGEX: RegExp;
};
