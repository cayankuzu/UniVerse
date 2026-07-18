import { resolveHomeUnreadCount } from "./homeUnreadState";

describe("resolveHomeUnreadCount", () => {
  it("keeps the strongest unread signal when badge data briefly drops to zero", () => {
    expect(
      resolveHomeUnreadCount({
        badgeUnreadCount: 0,
        cachedNotificationsUnreadCount: 2,
        shouldUseStartupPreview: true,
        startupUnreadCount: 2,
      }),
    ).toBe(2);
  });

  it("ignores startup preview counts once startup preview is no longer active", () => {
    expect(
      resolveHomeUnreadCount({
        badgeUnreadCount: 0,
        cachedNotificationsUnreadCount: 0,
        shouldUseStartupPreview: false,
        startupUnreadCount: 4,
      }),
    ).toBe(0);
  });

  it("clamps invalid counts to zero", () => {
    expect(
      resolveHomeUnreadCount({
        badgeUnreadCount: Number.NaN,
        cachedNotificationsUnreadCount: -2,
        shouldUseStartupPreview: true,
        startupUnreadCount: -1,
      }),
    ).toBe(0);
  });
});
