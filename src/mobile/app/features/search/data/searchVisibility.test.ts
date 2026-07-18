import {
  isSearchAlbumVisible,
  isSearchEventVisible,
  isSearchUserVisible,
} from "./searchVisibility";

describe("search visibility helpers", () => {
  it("hides followed club events from search discovery", () => {
    expect(
      isSearchEventVisible(
        { clubUsername: "followed-club" },
        { followingClubUsernames: ["followed-club"] },
      ),
    ).toBe(false);
  });

  it("hides followed albums from discovery", () => {
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          clubUsername: "followed-club",
          uploaderIsPrivate: false,
          username: "open-student",
        },
        { followingClubUsernames: ["followed-club"], followingUsernames: [] },
      ),
    ).toBe(false);
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          clubUsername: "open-club",
          uploaderIsPrivate: false,
          username: "followed-student",
        },
        { followingClubUsernames: [], followingUsernames: ["followed-student"] },
      ),
    ).toBe(false);
  });

  it("keeps followed public albums visible during explicit text search", () => {
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          clubUsername: "followed-club",
          uploaderIsPrivate: false,
          username: "followed-student",
        },
        {
          excludeFollowedContent: false,
          followingClubUsernames: ["followed-club"],
          followingUsernames: ["followed-student"],
        },
      ),
    ).toBe(true);
  });

  it("hides private albums and the viewer's own uploaded albums from search", () => {
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          uploaderIsPrivate: true,
          username: "private-student",
        },
        {},
      ),
    ).toBe(false);
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: true,
          clubUsername: "private-club",
          uploaderIsPrivate: false,
          username: "open-student",
        },
        {},
      ),
    ).toBe(false);
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          clubUsername: "viewer-club",
          uploaderIsPrivate: false,
          username: "viewer",
        },
        { viewerUsername: "viewer" },
      ),
    ).toBe(false);
    expect(
      isSearchAlbumVisible(
        {
          clubIsPrivate: false,
          clubUsername: "viewer-club",
          uploaderIsPrivate: false,
          username: "different-student",
        },
        { viewerUsername: "viewer-club" },
      ),
    ).toBe(true);
  });

  it("hides the viewer and followed users from profile search", () => {
    expect(isSearchUserVisible({ username: "cyn" }, { viewerUsername: "cyn" })).toBe(false);
    expect(
      isSearchUserVisible({ username: "followed-user" }, { followingUsernames: ["followed-user"] }),
    ).toBe(false);
    expect(
      isSearchUserVisible({ username: "discover-user" }, { followingUsernames: ["followed-user"] }),
    ).toBe(true);
    expect(
      isSearchUserVisible(
        { username: "followed-user" },
        {
          excludeFollowedContent: false,
          followingUsernames: ["followed-user"],
        },
      ),
    ).toBe(true);
  });
});
