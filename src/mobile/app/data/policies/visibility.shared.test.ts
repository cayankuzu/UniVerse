import {
  normalizeExplicitAlbumSurfaceVisibility,
  normalizeSharedEventAlbumVisibility,
  resolveAlbumProfileVisibilityState,
} from "./visibility.shared";

describe("normalizeSharedEventAlbumVisibility", () => {
  it("keeps own-profile-only selections intact", () => {
    expect(
      normalizeSharedEventAlbumVisibility({
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
      }),
    ).toEqual({
      showOnClubProfile: false,
      showOnOwnProfile: true,
      showOnProfile: true,
    });
  });

  it("forces club profile selections to also stay on the own profile", () => {
    expect(
      normalizeSharedEventAlbumVisibility({
        showOnClubProfile: true,
        showOnOwnProfile: false,
        showOnProfile: true,
      }),
    ).toEqual({
      showOnClubProfile: true,
      showOnOwnProfile: true,
      showOnProfile: true,
    });
  });
});

describe("normalizeExplicitAlbumSurfaceVisibility", () => {
  it("reads canonical surface snapshots when raw flags are absent", () => {
    expect(
      normalizeExplicitAlbumSurfaceVisibility({
        surfaceVisibility: {
          label: { text: "Kendim", type: "own" },
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
        },
      }),
    ).toEqual({
      showOnClubProfile: false,
      showOnOwnProfile: true,
      showOnProfile: true,
    });
  });

  it("prefers the canonical surface snapshot when raw flags drift out of sync", () => {
    expect(
      normalizeExplicitAlbumSurfaceVisibility({
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
        surfaceVisibility: {
          label: { text: "Kendim ve Kulüp", type: "club" },
          showOnClubProfile: true,
          showOnOwnProfile: true,
          showOnProfile: true,
        },
      }),
    ).toEqual({
      showOnClubProfile: true,
      showOnOwnProfile: true,
      showOnProfile: true,
    });
  });
});

describe("resolveAlbumProfileVisibilityState", () => {
  it("keeps own-only selection when the club surface is turned off", () => {
    expect(
      resolveAlbumProfileVisibilityState(
        {
          showOnClubProfile: true,
          showOnOwnProfile: true,
        },
        { target: "club", value: false },
      ),
    ).toEqual({
      showOnClubProfile: false,
      showOnOwnProfile: true,
    });
  });

  it("turns both flags on when club profile is enabled", () => {
    expect(
      resolveAlbumProfileVisibilityState(
        {
          showOnClubProfile: false,
          showOnOwnProfile: true,
        },
        { target: "club", value: true },
      ),
    ).toEqual({
      showOnClubProfile: true,
      showOnOwnProfile: true,
    });
  });

  it("prevents a club-only state when own profile is turned off", () => {
    expect(
      resolveAlbumProfileVisibilityState(
        {
          showOnClubProfile: true,
          showOnOwnProfile: true,
        },
        { target: "own", value: false },
      ),
    ).toEqual({
      showOnClubProfile: false,
      showOnOwnProfile: false,
    });
  });
});
