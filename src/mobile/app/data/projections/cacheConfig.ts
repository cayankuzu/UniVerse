/**
 * Centralized cache configuration for the Data Layer.
 * All cache timing, staleness, and prefetch settings live here.
 * Screens never define their own cache config — they consume from repositories.
 */

/** How long data is considered fresh (won't re-fetch). */
export const STALE_TIMES = {
  /** Home feed — users expect near-realtime. */
  homeFeed: 45_000,
  /** Notification badge - refreshed by startup, foreground, and realtime events. */
  notificationBadge: 90_000,
  /** Notification inbox items. */
  notifications: 30_000,
  /** Profile overview (own). */
  ownProfileOverview: 60_000,
  /** Profile content tabs (own). */
  ownProfileContent: 60_000,
  /** Profile overview (viewing another user). */
  viewProfileOverview: 45_000,
  /** Profile content tabs (viewing another). */
  viewProfileContent: 45_000,
  /** Relationship lists (followers/following). */
  relationships: 60_000,
  /** Search results. */
  search: 45_000,
  /** Event detail. */
  eventDetail: 3 * 60_000,
  /** Album event photos. */
  albumEvent: 60_000,
  /** Blocked users list. */
  blockedUsers: 5 * 60_000,
} as const;

/**
 * Extended staleTime for screens that reopen with a warm persisted cache.
 * Instagram-style: show cached content instantly, never refetch on screen
 * re-entry. Background sync handles freshness — user sees zero loading.
 * These values are intentionally high to eliminate refetch-on-mount flicker.
 */
export const CACHE_WARM_STALE_TIMES = {
  homeFeed: 20 * 60_000,
  notifications: 12 * 60_000,
  ownProfileOverview: 20 * 60_000,
  ownProfileContent: 20 * 60_000,
  viewProfileOverview: 10 * 60_000,
  viewProfileContent: 10 * 60_000,
  search: 12 * 60_000,
  eventDetail: 15 * 60_000,
  albumEvent: 15 * 60_000,
  relationships: 15 * 60_000,
} as const;

/** Page sizes for paginated queries. */
export const STANDARD_LIST_PAGE_SIZE = 33;

export const PAGE_SIZES = {
  homeFeed: STANDARD_LIST_PAGE_SIZE,
  notifications: STANDARD_LIST_PAGE_SIZE,
  profileContent: STANDARD_LIST_PAGE_SIZE,
  search: STANDARD_LIST_PAGE_SIZE,
  relationships: STANDARD_LIST_PAGE_SIZE,
  eventDetail: 1,
  albumEvent: STANDARD_LIST_PAGE_SIZE,
  blockedUsers: STANDARD_LIST_PAGE_SIZE,
} as const;

export const INITIAL_PAGE_SIZES = {
  homeFeed: 5,
  notifications: 15,
  profileContent: 12,
  search: 12,
  relationships: 20,
  albumEvent: 12,
  blockedUsers: 20,
} as const;

/** GC times — how long to keep unused data in cache.
 * Instagram-style: keep data alive longer so returning to screens is instant. */
export const GC_TIMES = {
  default: 30 * 60_000,
  longLived: 45 * 60_000,
} as const;

/**
 * Returns an effective staleTime for a screen.
 * If the screen has a warm cache snapshot, use the extended staleTime
 * so the initial mount serves from cache without an immediate refetch.
 * Background sync will refresh the data within the freshness SLA.
 */
export function resolveEffectiveStaleTime(
  baseStaleTime: number,
  cacheWarmStaleTime: number | undefined,
  hasCachedSnapshot: boolean,
): number {
  if (hasCachedSnapshot && cacheWarmStaleTime !== undefined) {
    return cacheWarmStaleTime;
  }
  return baseStaleTime;
}
