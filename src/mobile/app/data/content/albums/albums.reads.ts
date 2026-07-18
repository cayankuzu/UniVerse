import { supabase } from "../../../platform/supabase";
import { resolveProfileIdByUsername } from "../../profile/profileLookup";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import {
  listProfileVisibleAlbums,
  listVisibleAlbums,
  matchesProfileAlbumSurface,
  mergeAlbumCollections,
  normalizeAlbumLookupValue,
  resolveProfileAccountType,
  type AlbumPhotoWithMeta,
} from "./albums.shared";
import {
  fetchClubProfilePhotosFromTable,
  fetchEventPhotosFromTable,
  fetchFeedPhotosFromTable,
  fetchProfilePhotosFromTable,
} from "./albums.table";
import {
  getLocalAlbumShadowByEventIds,
  getLocalAlbumShadowFeed,
  getLocalAlbumShadowForProfile,
  registerAlbumLocalShadowMutation,
} from "./albums.local";
import { finalizeAlbumResult } from "./albums.visibility";
import {
  readTimedReadCacheValue,
  readTimedReadMapCacheValue,
  resetTimedReadCacheEntry,
  type TimedReadCacheEntry,
} from "../readCache";

type ViewerProfileIdentity = {
  accountType: "club" | "student" | null;
  userId: string;
  username: string;
};

const VIEWER_PROFILE_CACHE_TTL_MS = 1_000;
const PROFILE_ALBUM_CACHE_TTL_MS = 15_000;
const SEARCH_FEED_RPC_TIMEOUT_MS = 700;
const SEARCH_FEED_MIN_LIMIT = 24;
const SEARCH_FEED_MAX_LIMIT = 120;
const SEARCH_FEED_LIMIT_MULTIPLIER = 4;
const SEARCH_FEED_RPC_TIMEOUT = Symbol("search-feed-rpc-timeout");

const EMPTY_VIEWER_PROFILE: ViewerProfileIdentity = {
  accountType: null,
  userId: "",
  username: "",
};

const viewerProfileIdentityCache: TimedReadCacheEntry<ViewerProfileIdentity> = {
  expiresAt: 0,
  promise: null,
  value: null,
};

const profileAlbumCache = new Map<string, TimedReadCacheEntry<AlbumPhotoWithMeta[]>>();

function resetAlbumReadCaches() {
  resetTimedReadCacheEntry(viewerProfileIdentityCache);
  profileAlbumCache.clear();
}

registerAlbumLocalShadowMutation(() => {
  profileAlbumCache.clear();
});

function cloneAlbums(items: AlbumPhotoWithMeta[]) {
  return items.slice();
}

function resolveSearchFeedLimit(limit?: number) {
  const parsed = Number(limit || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return SEARCH_FEED_MIN_LIMIT;
  }
  return Math.max(
    SEARCH_FEED_MIN_LIMIT,
    Math.min(Math.trunc(parsed) * SEARCH_FEED_LIMIT_MULTIPLIER, SEARCH_FEED_MAX_LIMIT),
  );
}

async function awaitSearchFeedRpcWithTimeout<T>(request: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race<T | typeof SEARCH_FEED_RPC_TIMEOUT>([
      request,
      new Promise<typeof SEARCH_FEED_RPC_TIMEOUT>((resolve) => {
        timeoutId = setTimeout(() => resolve(SEARCH_FEED_RPC_TIMEOUT), SEARCH_FEED_RPC_TIMEOUT_MS);
      }),
    ]);
    if (result === SEARCH_FEED_RPC_TIMEOUT) {
      debugWarn("CONTENT/ALBUMS", "getSearchFeed:rpc-timeout-fallback", {
        timeoutMs: SEARCH_FEED_RPC_TIMEOUT_MS,
      });
      return null;
    }
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function readViewerProfileIdentity(): Promise<ViewerProfileIdentity> {
  return readTimedReadCacheValue({
    entry: viewerProfileIdentityCache,
    task: async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const viewerId = String(user?.id || "").trim();
        if (!viewerId) {
          return EMPTY_VIEWER_PROFILE;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("username,account_type")
          .eq("user_id", viewerId)
          .is("deleted_at", null)
          .maybeSingle();

        return {
          accountType:
            profile?.account_type === "club"
              ? "club"
              : profile?.account_type === "student"
                ? "student"
                : null,
          userId: viewerId,
          username: normalizeAlbumLookupValue(profile?.username),
        } satisfies ViewerProfileIdentity;
      } catch (error) {
        debugWarn("CONTENT/ALBUMS", "viewer-profile-identity-resolve-failed", {
          message: String(
            (error as { message?: string } | null)?.message ||
              "viewer-profile-identity-resolve-failed",
          ),
        });
        return EMPTY_VIEWER_PROFILE;
      }
    },
    ttlMs: VIEWER_PROFILE_CACHE_TTL_MS,
  });
}

export function resetAlbumReadCachesForTests() {
  resetAlbumReadCaches();
}

export const albumReads = {
  getFeed: async (): Promise<AlbumPhotoWithMeta[]> => {
    debugLog("ALBUMS", "getFeed:start");
    const localShadow = await getLocalAlbumShadowFeed();

    const fromRpc = await listVisibleAlbums("feed");
    if (fromRpc && fromRpc.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromRpc, localShadow), "feed");
    }

    const fromTable = await fetchFeedPhotosFromTable();
    if (fromTable && fromTable.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromTable, localShadow), "feed");
    }

    debugLog("ALBUMS", "getFeed:result", { count: localShadow.length });
    return finalizeAlbumResult(localShadow, "feed");
  },

  getSearchFeed: async (limit?: number): Promise<AlbumPhotoWithMeta[]> => {
    debugLog("ALBUMS", "getSearchFeed:start");
    const sourceLimit = resolveSearchFeedLimit(limit);

    const fromRpc = await awaitSearchFeedRpcWithTimeout(listVisibleAlbums("search"));
    if (fromRpc && fromRpc.length > 0) {
      return finalizeAlbumResult(fromRpc.slice(0, sourceLimit), "search");
    }

    const fromTable = await fetchFeedPhotosFromTable("search", { limit: sourceLimit });
    if (fromTable && fromTable.length > 0) {
      return finalizeAlbumResult(fromTable, "search");
    }

    return [];
  },

  getHomeFeed: async (eventIds: string[]): Promise<AlbumPhotoWithMeta[]> => {
    const uniqueEventIds = Array.from(
      new Set(eventIds.map((item) => String(item || "").trim()).filter(Boolean)),
    );
    if (!uniqueEventIds.length) return [];

    const relatedFeed = await albumReads.getVisibleByEventIds(uniqueEventIds);
    if (relatedFeed.length > 0) {
      return finalizeAlbumResult(relatedFeed, "feed");
    }
    return [];
  },

  getVisibleByEventIds: async (eventIds: string[]): Promise<AlbumPhotoWithMeta[]> => {
    const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)));
    if (!uniqueEventIds.length) return [];

    const localShadow = await getLocalAlbumShadowByEventIds(uniqueEventIds);

    const fromRpc = await listVisibleAlbums("feed", undefined, uniqueEventIds);
    if (fromRpc && fromRpc.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromRpc, localShadow), "feed");
    }

    const fromTable = await fetchEventPhotosFromTable(uniqueEventIds, "feed");
    if (fromTable && fromTable.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromTable, localShadow), "feed");
    }

    return finalizeAlbumResult(localShadow, "feed");
  },

  getPhotos: async (username: string): Promise<AlbumPhotoWithMeta[]> => {
    const normalizedUsername = normalizeAlbumLookupValue(username);
    if (!normalizedUsername) return [];
    const viewerIdentity = await readViewerProfileIdentity();
    const cacheKey = `${viewerIdentity.userId || "anon"}:${normalizedUsername}`;
    return readTimedReadMapCacheValue({
      cache: profileAlbumCache,
      clone: cloneAlbums,
      key: cacheKey,
      task: async () => {
        debugLog("ALBUMS", "getPhotos:start", { username: normalizedUsername });
        const isViewerProfile = viewerIdentity.username === normalizedUsername;
        let localShadow = isViewerProfile
          ? await getLocalAlbumShadowForProfile(normalizedUsername)
          : [];
        const targetUserId =
          (await resolveProfileIdByUsername(normalizedUsername)) ||
          (isViewerProfile ? viewerIdentity.userId : null);
        const targetAccountType =
          (await resolveProfileAccountType(targetUserId)) ||
          (isViewerProfile ? viewerIdentity.accountType : null);

        if (isViewerProfile && targetAccountType === "club") {
          const clubEventRpcName = targetUserId
            ? "list_profile_visible_events"
            : "list_club_visible_events";
          const clubEventRpcArgs = targetUserId
            ? { target_profile_id: targetUserId }
            : { target_username: normalizedUsername };
          const { data: clubEventRows, error: clubEventError } = await supabase.rpc(
            clubEventRpcName,
            clubEventRpcArgs,
          );
          const clubEventIds =
            !clubEventError && Array.isArray(clubEventRows)
              ? clubEventRows
                  .map((row) => String((row as { id?: string }).id || "").trim())
                  .filter(Boolean)
              : [];
          if (clubEventIds.length > 0) {
            const clubEventShadow = await getLocalAlbumShadowByEventIds(clubEventIds);
            localShadow = mergeAlbumCollections(
              localShadow,
              clubEventShadow.filter((item) => matchesProfileAlbumSurface(item, "club")),
            );
          }
        }
        localShadow = localShadow.filter((item) =>
          matchesProfileAlbumSurface(item, targetAccountType),
        );

        const fromRpc = targetUserId ? await listProfileVisibleAlbums(targetUserId) : null;
        if (Array.isArray(fromRpc)) {
          return finalizeAlbumResult(mergeAlbumCollections(fromRpc, localShadow), "profile");
        }

        const fromTable =
          targetAccountType === "club"
            ? await fetchClubProfilePhotosFromTable(normalizedUsername, targetUserId)
            : await fetchProfilePhotosFromTable(normalizedUsername, targetUserId);
        if (fromTable && fromTable.length > 0) {
          return finalizeAlbumResult(mergeAlbumCollections(fromTable, localShadow), "profile");
        }

        debugLog("ALBUMS", "getPhotos:result", {
          count: localShadow.length,
          username: normalizedUsername,
        });
        return finalizeAlbumResult(localShadow, "profile");
      },
      ttlMs: PROFILE_ALBUM_CACHE_TTL_MS,
    });
  },

  getEventPhotos: async (eventId: string): Promise<AlbumPhotoWithMeta[]> => {
    const localShadow = await getLocalAlbumShadowByEventIds([eventId]);

    const fromRpc = await listVisibleAlbums("event_album", undefined, [eventId]);
    if (fromRpc && fromRpc.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromRpc, localShadow), "event_album");
    }

    const fromTable = await fetchEventPhotosFromTable([eventId], "event_album");
    if (fromTable && fromTable.length > 0) {
      return finalizeAlbumResult(mergeAlbumCollections(fromTable, localShadow), "event_album");
    }

    return finalizeAlbumResult(localShadow, "event_album");
  },
};
