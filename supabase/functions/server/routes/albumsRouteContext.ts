import * as kv from "../kv_store.ts";
import type {
  EdgeRouteApp,
  KvAlbumPhotoRecord,
  KvBlockedRecord,
  KvProfileRecord,
  ServerRouteDeps,
} from "../types.ts";
import { createBlockedStateReader } from "../services/blockedState.ts";
import { createAlbumContextOperations } from "./albumsContextOperations.ts";
import { createAlbumProfileLoader } from "./albumsProfileLoader.ts";
import { CompatRouteValidationError } from "./compatRouteValidation.ts";

export type DbAlbumPhotoRow = {
  caption?: string | null;
  created_at?: string | null;
  event_id?: string | null;
  id: string;
  media_paths?: string[] | null;
  show_on_club_profile?: boolean | null;
  show_on_profile?: boolean | null;
  show_on_user_profile?: boolean | null;
  storage_path?: string | null;
  title?: string | null;
  user_id?: string | null;
};

export type DbPhotoLikeRow = {
  photo_id?: string | null;
  user_id?: string | null;
};

export type DbPhotoCommentCountRow = {
  photo_id?: string | null;
};

export type DbEventRow = {
  club_id?: string | null;
  ends_at?: string | null;
  id: string;
  is_cancelled?: boolean | null;
  title?: string | null;
  visibility?: string | null;
};

export type PhotoModerationContext = {
  clubUserId: string;
  eventId: string;
  kvPhoto: KvAlbumPhotoRecord | null;
  photoUserId: string;
};

export type AlbumResponseRecord = KvAlbumPhotoRecord & {
  clubIsPrivate: boolean;
  clubUserId?: string;
  clubUsername: string;
  comments: number;
  effectiveVisibility: string;
  eventId: string;
  eventTitle: string;
  eventVisibility: string;
  images: string[];
  liked: boolean;
  likes: number;
  name: string;
  photoCount: number;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  showOnProfile: boolean;
  uploaderIsPrivate: boolean;
  userImage: string;
  userUniversity: string;
  username: string;
};

export type AlbumRouteApp = EdgeRouteApp;

export function toRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof CompatRouteValidationError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  return {
    message: fallbackMessage,
    status: 500,
  };
}

export {
  countAlbumPhotos,
  normalizeAlbumSurfaceVisibility,
  normalizeDbPhotoImages,
} from "./albumsSurfaceHelpers.ts";

export function createAlbumRouteContext(
  deps: Pick<ServerRouteDeps, "adminSupabase" | "generateId">,
) {
  const { adminSupabase, generateId } = deps;
  const loadBlockedRows = (userId: string) =>
    kv.get<KvBlockedRecord[]>(`blocked:${userId}`).then((value) => value || []);

  return function createAlbumRequestContext() {
    const blockedState = createBlockedStateReader({ loadBlockedRows });
    const profileCache = new Map<string, KvProfileRecord | null>();
    const getProfile = createAlbumProfileLoader({
      adminSupabase,
      profileCache,
    });
    const operations = createAlbumContextOperations({
      adminSupabase,
      blockedState,
      generateId,
      getProfile,
    });

    return {
      ...operations,
      getProfile,
      isBlockedPair: blockedState.isBlockedPair,
    };
  };
}

export type AlbumRouteContextFactory = ReturnType<typeof createAlbumRouteContext>;
export type AlbumRouteContextHelpers = ReturnType<AlbumRouteContextFactory>;
