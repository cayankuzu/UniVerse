import {
  normalizeDisplayProfileFollowStatus,
  resolveEffectiveProfileFollowStatus,
  resolveProfileContentAccess,
  resolveProfileFollowStatus,
  resolveRelationshipBackedProfileFollowStatus,
} from "../../domain/viewProfileState.helpers";

describe("resolveProfileFollowStatus", () => {
  it("prefers optimistic state while a follow mutation is in flight", () => {
    expect(
      resolveProfileFollowStatus({
        followStatusFromDirect: "none",
        followStatusFromProjection: "following",
        optimisticFollowStatus: "requested",
      }),
    ).toBe("requested");
  });

  it("keeps optimistic none during an in-flight unfollow instead of falling back to stale following", () => {
    expect(
      resolveProfileFollowStatus({
        followStatusFromDirect: null,
        followStatusFromProjection: "following",
        optimisticFollowStatus: "none",
      }),
    ).toBe("none");
  });

  it("prefers the direct database status over a stale projection snapshot", () => {
    expect(
      resolveProfileFollowStatus({
        followStatusFromDirect: "none",
        followStatusFromProjection: "following",
        optimisticFollowStatus: null,
      }),
    ).toBe("none");
  });

  it("falls back to the projection status when the direct status is not loaded yet", () => {
    expect(
      resolveProfileFollowStatus({
        followStatusFromDirect: null,
        followStatusFromProjection: "following",
        optimisticFollowStatus: null,
      }),
    ).toBe("following");
  });

  it("prefers the relationship snapshot when it confirms the viewer still follows the profile", () => {
    expect(
      resolveRelationshipBackedProfileFollowStatus({
        followStatusFromProjection: "none",
        relationshipSnapshot: {
          followingUsernames: ["cyn"],
        },
        targetUsername: "cyn",
      }),
    ).toBe("following");
  });

  it("keeps requested when the relationship snapshot says not-following but the server still reports a pending request", () => {
    expect(
      resolveRelationshipBackedProfileFollowStatus({
        followStatusFromProjection: "requested",
        relationshipSnapshot: {
          followingUsernames: ["baska-hesap"],
        },
        targetUsername: "cyn",
      }),
    ).toBe("requested");
  });

  it("normalizes club requested state to none for display surfaces", () => {
    expect(
      normalizeDisplayProfileFollowStatus({
        accountType: "club",
        followStatus: "requested",
      }),
    ).toBe("none");
  });

  it("stabilizes private follow state from capabilities when content access is allowed", () => {
    expect(
      resolveEffectiveProfileFollowStatus({
        allowCapabilityOverride: true,
        capabilityCanViewContent: true,
        followStatus: "none",
        isOwnProfile: false,
        profile: { isPrivate: true },
      }),
    ).toBe("following");
  });

  it("allows private content when capabilities confirm access", () => {
    expect(
      resolveProfileContentAccess({
        capabilityCanViewContent: true,
        followStatus: "none",
        hasAuthoritativeFollowStatus: false,
        isOwnProfile: false,
        profile: { isPrivate: true },
      }),
    ).toBe(true);
  });

  it("fails closed for private content when authoritative follow state says access is gone", () => {
    expect(
      resolveProfileContentAccess({
        capabilityCanViewContent: true,
        followStatus: "none",
        hasAuthoritativeFollowStatus: true,
        isOwnProfile: false,
        profile: { isPrivate: true },
      }),
    ).toBe(false);
  });

  it("does not backfill following state from stale capabilities when follow state is authoritative", () => {
    expect(
      resolveEffectiveProfileFollowStatus({
        allowCapabilityOverride: false,
        capabilityCanViewContent: true,
        followStatus: "none",
        isOwnProfile: false,
        profile: { isPrivate: true },
      }),
    ).toBe("none");
  });
});
