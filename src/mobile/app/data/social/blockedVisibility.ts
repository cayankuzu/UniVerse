import type { CommentItem, SearchUserResult } from "../contracts/api";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import type { ProjectionHomeFeedItem } from "../projections/projections.types";
import { debugWarn } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";
import { BlockAPI } from "./social.block";
import { readAuthenticatedUserId } from "./social.helpers";

const BLOCKED_VISIBILITY_TTL_MS = 30_000;

export type BlockedVisibilitySnapshot = {
  blockedIds: Set<string>;
  blockedUsernames: Set<string>;
  viewerId: string;
};

type CachedBlockedVisibility = {
  expiresAt: number;
  incomingIds: string[];
  incomingUsernames: string[];
  outgoingIds: string[];
  outgoingUsernames: string[];
};

type FilterBlockedAlbumOptions = {
  preserveViewerOwned?: boolean;
  viewerId?: string | null;
  viewerUsername?: string | null;
};

const blockedVisibilityCache = new Map<string, CachedBlockedVisibility>();

export function resetBlockedVisibilityCache() {
  blockedVisibilityCache.clear();
}

export function invalidateViewerBlockedVisibility(viewerId?: string | null) {
  const normalizedViewerId = normalizeId(viewerId);
  if (!normalizedViewerId) {
    blockedVisibilityCache.clear();
    return;
  }
  blockedVisibilityCache.delete(normalizedViewerId);
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeDirection(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function createSnapshot(
  viewerId: string,
  ids: Array<string | null | undefined>,
  usernames: Array<string | null | undefined>,
): BlockedVisibilitySnapshot {
  return {
    blockedIds: new Set(ids.map((item) => normalizeId(item)).filter(Boolean)),
    blockedUsernames: new Set(usernames.map((item) => normalizeUsername(item)).filter(Boolean)),
    viewerId,
  };
}

export function createEmptyBlockedVisibilitySnapshot(): BlockedVisibilitySnapshot {
  return createSnapshot("", [], []);
}

export function replaceViewerBlockedVisibility(params: {
  ids?: Array<string | null | undefined>;
  ttlMs?: number;
  usernames?: Array<string | null | undefined>;
  viewerId: string;
}) {
  const viewerId = normalizeId(params.viewerId);
  if (!viewerId) return;
  const cached = blockedVisibilityCache.get(viewerId);

  blockedVisibilityCache.set(viewerId, {
    expiresAt: Date.now() + (params.ttlMs ?? BLOCKED_VISIBILITY_TTL_MS),
    incomingIds: [...(cached?.incomingIds || [])],
    incomingUsernames: [...(cached?.incomingUsernames || [])],
    outgoingIds:
      params.ids === undefined
        ? [...(cached?.outgoingIds || [])]
        : params.ids.map((item) => normalizeId(item)).filter(Boolean),
    outgoingUsernames:
      params.usernames === undefined
        ? [...(cached?.outgoingUsernames || [])]
        : params.usernames.map((item) => normalizeUsername(item)).filter(Boolean),
  });
}

function createSnapshotFromCache(viewerId: string, cache: CachedBlockedVisibility) {
  return createSnapshot(
    viewerId,
    [...cache.outgoingIds, ...cache.incomingIds],
    [...cache.outgoingUsernames, ...cache.incomingUsernames],
  );
}

type ViewerBlockedSnapshotRow = {
  direction?: string | null;
  user_id?: string | null;
  userId?: string | null;
  username?: string | null;
};

async function readViewerBlockedVisibilityRpc(viewerId: string) {
  const { data, error } = await supabase.rpc("viewer_blocked_snapshot", {
    viewer_id: viewerId || null,
  });
  if (error) {
    debugWarn("SOCIAL/BLOCKED", "blocked-visibility-rpc-failed", {
      message: error.message,
      viewerId,
    });
    return null;
  }
  if (!Array.isArray(data)) {
    return null;
  }

  const incomingIds = new Set<string>();
  const incomingUsernames = new Set<string>();
  const outgoingIds = new Set<string>();
  const outgoingUsernames = new Set<string>();

  data.forEach((row) => {
    const item = row as ViewerBlockedSnapshotRow;
    const userId = normalizeId(item.user_id || item.userId);
    const username = normalizeUsername(item.username);
    const direction = normalizeDirection(item.direction);
    if (!userId && !username) {
      return;
    }
    if (direction === "incoming") {
      if (userId) incomingIds.add(userId);
      if (username) incomingUsernames.add(username);
      return;
    }
    if (userId) outgoingIds.add(userId);
    if (username) outgoingUsernames.add(username);
  });

  return {
    expiresAt: Date.now() + BLOCKED_VISIBILITY_TTL_MS,
    incomingIds: Array.from(incomingIds),
    incomingUsernames: Array.from(incomingUsernames),
    outgoingIds: Array.from(outgoingIds),
    outgoingUsernames: Array.from(outgoingUsernames),
  } satisfies CachedBlockedVisibility;
}

export function isBlockedProfile(
  snapshot: BlockedVisibilitySnapshot,
  profile: { id?: string | null; userId?: string | null; username?: string | null },
) {
  const userId = normalizeId(profile.userId || profile.id);
  const username = normalizeUsername(profile.username);
  return Boolean(
    (userId && snapshot.blockedIds.has(userId)) ||
    (username && snapshot.blockedUsernames.has(username)),
  );
}

export function filterBlockedProfiles<
  T extends { id?: string | null; userId?: string | null; username?: string | null },
>(items: T[], snapshot: BlockedVisibilitySnapshot) {
  return items.filter((item) => !isBlockedProfile(snapshot, item));
}

export function isBlockedEventOwner(
  snapshot: BlockedVisibilitySnapshot,
  event: Pick<EventWithMeta, "clubUserId" | "clubUsername" | "feedActorUsername">,
) {
  return (
    isBlockedProfile(snapshot, {
      id: event.clubUserId,
      username: event.clubUsername,
    }) ||
    isBlockedProfile(snapshot, {
      username: event.feedActorUsername,
    })
  );
}

export function filterBlockedEvents<
  T extends Pick<EventWithMeta, "clubUserId" | "clubUsername" | "feedActorUsername">,
>(items: T[], snapshot: BlockedVisibilitySnapshot) {
  return items.filter((item) => !isBlockedEventOwner(snapshot, item));
}

export function isBlockedAlbumOwner(
  snapshot: BlockedVisibilitySnapshot,
  album: Pick<AlbumPhotoWithMeta, "clubUserId" | "clubUsername" | "userId" | "username">,
) {
  return (
    isBlockedProfile(snapshot, {
      id: album.userId,
      username: album.username,
    }) ||
    isBlockedProfile(snapshot, {
      id: album.clubUserId,
      username: album.clubUsername,
    })
  );
}

export function filterBlockedAlbums<
  T extends Pick<AlbumPhotoWithMeta, "clubUserId" | "clubUsername" | "userId" | "username">,
>(items: T[], snapshot: BlockedVisibilitySnapshot, options: FilterBlockedAlbumOptions = {}) {
  const viewerId = normalizeId(options.viewerId ?? snapshot.viewerId);
  const viewerUsername = normalizeUsername(options.viewerUsername);

  return items.filter((item) => {
    if (options.preserveViewerOwned) {
      const isViewerOwned = Boolean(
        (viewerId &&
          (viewerId === normalizeId(item.userId) || viewerId === normalizeId(item.clubUserId))) ||
        (viewerUsername &&
          (viewerUsername === normalizeUsername(item.username) ||
            viewerUsername === normalizeUsername(item.clubUsername))),
      );
      if (isViewerOwned) {
        return true;
      }
    }

    return !isBlockedAlbumOwner(snapshot, item);
  });
}

export function getBlockedAlbumEventWarning(
  snapshot: BlockedVisibilitySnapshot,
  album: Pick<AlbumPhotoWithMeta, "clubUserId" | "clubUsername" | "userId" | "username">,
) {
  if (
    isBlockedProfile(snapshot, {
      id: album.clubUserId,
      username: album.clubUsername,
    })
  ) {
    return "Bu kulübü engellediğiniz için etkinlik kartı gösterilemiyor.";
  }

  if (
    isBlockedProfile(snapshot, {
      id: album.userId,
      username: album.username,
    })
  ) {
    return "Bu kullanıcıyı engellediğiniz için etkinlik kartı gösterilemiyor.";
  }

  return null;
}

export function getBlockedEventAlbumWarning(
  snapshot: BlockedVisibilitySnapshot,
  event: Pick<EventWithMeta, "clubUserId" | "clubUsername" | "feedActorUsername">,
) {
  if (
    isBlockedProfile(snapshot, {
      id: event.clubUserId,
      username: event.clubUsername,
    })
  ) {
    return "Bu kulübü engellediğiniz için albüm gösterilemiyor.";
  }

  if (
    isBlockedProfile(snapshot, {
      username: event.feedActorUsername,
    })
  ) {
    return "Bu kullanıcıyı engellediğiniz için albüm gösterilemiyor.";
  }

  return null;
}

export async function loadBlockedAlbumEventWarning(
  album: Pick<AlbumPhotoWithMeta, "clubUserId" | "clubUsername" | "userId" | "username">,
  viewerIdHint?: string | null,
) {
  const snapshot = await loadViewerBlockedVisibilityOrEmpty(viewerIdHint, {
    scope: "SOCIAL/BLOCKED",
    warningKey: "blocked-album-event-warning-load-failed",
  });
  return getBlockedAlbumEventWarning(snapshot, album);
}

export async function loadBlockedEventAlbumWarning(
  event: Pick<EventWithMeta, "clubUserId" | "clubUsername" | "feedActorUsername">,
  viewerIdHint?: string | null,
) {
  const snapshot = await loadViewerBlockedVisibilityOrEmpty(viewerIdHint, {
    scope: "SOCIAL/BLOCKED",
    warningKey: "blocked-event-album-warning-load-failed",
  });
  return getBlockedEventAlbumWarning(snapshot, event);
}

export function filterBlockedHomeFeedItems(
  items: ProjectionHomeFeedItem[],
  snapshot: BlockedVisibilitySnapshot,
) {
  return items.filter((item) =>
    item.kind === "event"
      ? !isBlockedEventOwner(snapshot, item.event)
      : !isBlockedAlbumOwner(snapshot, item.album),
  );
}

export function filterBlockedSearchUsers(
  items: SearchUserResult[],
  snapshot: BlockedVisibilitySnapshot,
) {
  return filterBlockedProfiles(items, snapshot);
}

export function filterBlockedComments<T extends Pick<CommentItem, "userId" | "username">>(
  items: T[],
  snapshot: BlockedVisibilitySnapshot,
) {
  return items.filter((item) => !isBlockedProfile(snapshot, item));
}

export function filterBlockedNotificationActors<
  T extends { fromUserId?: string | null; fromUsername?: string | null },
>(items: T[], snapshot: BlockedVisibilitySnapshot) {
  return items.filter(
    (item) =>
      !isBlockedProfile(snapshot, {
        id: item.fromUserId,
        username: item.fromUsername,
      }),
  );
}

export function filterBlockedUserIds(
  userIds: Array<string | null | undefined>,
  snapshot: BlockedVisibilitySnapshot,
) {
  return userIds
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((userId, index, items) => items.indexOf(userId) === index)
    .filter((userId) => !snapshot.blockedIds.has(userId));
}

export async function loadViewerBlockedVisibility(
  viewerIdHint?: string | null,
): Promise<BlockedVisibilitySnapshot> {
  const viewerId = normalizeId(viewerIdHint) || (await readAuthenticatedUserId()) || "";
  if (!viewerId) {
    return createEmptyBlockedVisibilitySnapshot();
  }

  const cached = blockedVisibilityCache.get(viewerId);
  if (cached && cached.expiresAt > Date.now()) {
    return createSnapshotFromCache(viewerId, cached);
  }

  const rpcSnapshot = await readViewerBlockedVisibilityRpc(viewerId);
  if (rpcSnapshot) {
    blockedVisibilityCache.set(viewerId, rpcSnapshot);
    return createSnapshotFromCache(viewerId, rpcSnapshot);
  }

  const items = await BlockAPI.getBlocked().catch((error) => {
    debugWarn("SOCIAL/BLOCKED", "blocked-visibility-api-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "blocked-visibility-api-failed",
      ),
      viewerId,
    });
    return [];
  });
  const fallbackSnapshot = {
    expiresAt: Date.now() + BLOCKED_VISIBILITY_TTL_MS,
    incomingIds: [],
    incomingUsernames: [],
    outgoingIds: items.map((item) => normalizeId(item.userId)),
    outgoingUsernames: items.map((item) => normalizeUsername(item.username)),
  } satisfies CachedBlockedVisibility;

  blockedVisibilityCache.set(viewerId, fallbackSnapshot);

  return createSnapshotFromCache(viewerId, fallbackSnapshot);
}

export async function loadViewerBlockedVisibilityOrEmpty(
  viewerIdHint?: string | null,
  options: {
    scope?: string;
    warningKey?: string;
  } = {},
): Promise<BlockedVisibilitySnapshot> {
  try {
    return await loadViewerBlockedVisibility(viewerIdHint);
  } catch (error) {
    debugWarn(
      options.scope || "SOCIAL/BLOCKED",
      options.warningKey || "blocked-visibility-load-failed",
      {
        message: String(
          (error as { message?: string } | null)?.message || "blocked-visibility-load-failed",
        ),
        viewerIdHint: normalizeId(viewerIdHint) || undefined,
      },
    );
    return createEmptyBlockedVisibilitySnapshot();
  }
}
