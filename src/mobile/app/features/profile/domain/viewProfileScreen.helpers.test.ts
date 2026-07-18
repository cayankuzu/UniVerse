import {
  buildViewProfileBlockRefreshKeys,
  buildViewProfileFollowActionPlan,
  resolveViewProfileContentWarning,
  resolveViewProfileListAccess,
} from "../application/viewProfileScreenHelpers";

describe("view profile screen helpers", () => {
  it("requests confirmation before unfollowing a private student profile", () => {
    const plan = buildViewProfileFollowActionPlan({
      currentStatus: "following",
      profile: {
        accountType: "student",
        isPrivate: true,
      },
    });

    expect(plan.targetStatus).toBe("none");
    expect(plan.confirmation).toEqual(
      expect.objectContaining({
        confirmLabel: "Takibi Bırak",
        title: "Takibi Bırak",
      }),
    );
  });

  it("follows immediately for a club profile", () => {
    const plan = buildViewProfileFollowActionPlan({
      currentStatus: "none",
      profile: {
        accountType: "club",
        isPrivate: true,
      },
    });

    expect(plan.targetStatus).toBe("following");
    expect(plan.confirmation).toBeNull();
  });

  it("returns the locked reason for restricted relationship lists", () => {
    expect(
      resolveViewProfileListAccess({
        canViewList: false,
        fallbackMessage: "Takipçi listesi bu kullanıcı için sınırlı.",
        lockedReasonText: "Liste gizli",
      }),
    ).toEqual({
      allowed: false,
      warningMessage: "Liste gizli",
    });
  });

  it("builds the same broad stale keys used by the profile block flow", () => {
    const keys = buildViewProfileBlockRefreshKeys({
      username: "targetuser",
      viewerCacheKey: "viewer-1",
      viewerUsername: "vieweruser",
    });

    expect(keys).toEqual([
      ["screen", "profile-content", "targetuser"],
      ["screen", "home", "viewer-1"],
      ["screen", "notifications", "viewer-1"],
      ["screen", "event-detail"],
      ["screen", "album-event"],
      ["screen", "search"],
    ]);
  });

  it("falls back to the generic content warning when no lock reason is available", () => {
    expect(
      resolveViewProfileContentWarning({
        contentLockedMessage: "",
        lockedReasonText: null,
      }),
    ).toBe("Bu hesabın içerikleri görüntülenemiyor.");
  });
});
