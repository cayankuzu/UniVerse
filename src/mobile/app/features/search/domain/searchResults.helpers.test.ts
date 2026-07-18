import { resolveSearchAlbumOpenDecision } from "../application/searchAlbumAccess";

describe("resolveSearchAlbumOpenDecision", () => {
  it("opens the album viewer when the album is visible for search", () => {
    expect(
      resolveSearchAlbumOpenDecision({
        currentUsername: "viewer",
        item: {
          clubUsername: "open-club",
          showOnClubProfile: true,
          showOnProfile: true,
          username: "album-owner",
        } as any,
        relationByClub: {},
      }),
    ).toEqual({ kind: "viewer" });
  });

  it("returns a warning when the album is hidden behind follow access", () => {
    expect(
      resolveSearchAlbumOpenDecision({
        currentUsername: "viewer",
        item: {
          clubUsername: "private-club",
          showOnClubProfile: false,
          showOnProfile: false,
          username: "album-owner",
        } as any,
        relationByClub: {
          "private-club": {
            clubIsPrivate: true,
            followsClub: false,
            followingUsernames: [],
          },
        },
      }),
    ).toEqual({
      kind: "warning",
      message: "Gizli hesap albumleri arama listesinde gösterilmez.",
    });
  });
});
