import {
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  PAGE_SIZES,
  STALE_TIMES,
  resolveEffectiveStaleTime,
} from "./cacheConfig";

describe("cacheConfig", () => {
  describe("resolveEffectiveStaleTime", () => {
    it("returns base staleTime when no cached snapshot exists", () => {
      expect(
        resolveEffectiveStaleTime(STALE_TIMES.homeFeed, CACHE_WARM_STALE_TIMES.homeFeed, false),
      ).toBe(STALE_TIMES.homeFeed);
    });

    it("returns cacheWarmStaleTime when a cached snapshot exists", () => {
      expect(
        resolveEffectiveStaleTime(STALE_TIMES.homeFeed, CACHE_WARM_STALE_TIMES.homeFeed, true),
      ).toBe(CACHE_WARM_STALE_TIMES.homeFeed);
    });

    it("returns base staleTime when cacheWarmStaleTime is undefined even with cache", () => {
      expect(resolveEffectiveStaleTime(STALE_TIMES.search, undefined, true)).toBe(
        STALE_TIMES.search,
      );
    });

    it("returns base staleTime when both cache and cacheWarm are absent", () => {
      expect(resolveEffectiveStaleTime(10_000, undefined, false)).toBe(10_000);
    });
  });

  describe("CACHE_WARM_STALE_TIMES", () => {
    it("every cache-warm staleTime is greater than the corresponding base staleTime", () => {
      const pairs: Array<[keyof typeof CACHE_WARM_STALE_TIMES, keyof typeof STALE_TIMES]> = [
        ["homeFeed", "homeFeed"],
        ["notifications", "notifications"],
        ["search", "search"],
        ["eventDetail", "eventDetail"],
        ["albumEvent", "albumEvent"],
        ["relationships", "relationships"],
      ];
      for (const [warmKey, baseKey] of pairs) {
        expect(CACHE_WARM_STALE_TIMES[warmKey]).toBeGreaterThan(STALE_TIMES[baseKey]);
      }
    });
  });

  describe("INITIAL_PAGE_SIZES", () => {
    it("keeps initial payloads smaller than follow-up pages", () => {
      expect(INITIAL_PAGE_SIZES).toMatchObject({
        albumEvent: 12,
        blockedUsers: 20,
        homeFeed: 5,
        notifications: 15,
        profileContent: 12,
        relationships: 20,
        search: 12,
      });

      for (const key of Object.keys(INITIAL_PAGE_SIZES) as Array<keyof typeof INITIAL_PAGE_SIZES>) {
        expect(INITIAL_PAGE_SIZES[key]).toBeLessThanOrEqual(PAGE_SIZES[key]);
      }
    });
  });
});
