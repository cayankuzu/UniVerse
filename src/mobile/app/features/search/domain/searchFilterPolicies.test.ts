import {
  filterSearchAlbums,
  filterSearchEvents,
  filterSearchUsers,
} from "../application/searchFiltering";

describe("search filter policies", () => {
  const viewerIdentity = {
    userId: "viewer-id",
    username: "viewer",
  };

  it("hides followed event results in non-mock mode", () => {
    const items = filterSearchEvents({
      blockedSet: new Set(["blocked-club"]),
      excludeFollowedContent: true,
      followingClubUsernames: new Set(["followed-club"]),
      followingUsernames: new Set(["followed-student"]),
      items: [
        {
          clubUsername: "followed-club",
          date: "2026-03-18",
          id: "event-followed",
          location: "Campus",
          title: "Followed event",
        },
        {
          clubUsername: "blocked-club",
          date: "2026-03-18",
          id: "event-blocked",
          location: "Campus",
          title: "Blocked event",
        },
        {
          clubUsername: "open-club",
          date: "2026-03-18",
          feedActorUsername: "followed-student",
          id: "event-followed-student",
          location: "Campus",
          title: "Followed student event",
        },
      ] as any,
      viewerIdentity,
    });

    expect(items.map((item) => item.id)).toEqual([]);
  });

  it("hides followed album results in non-mock mode", () => {
    const items = filterSearchAlbums({
      blockedSet: new Set(["blocked-user"]),
      excludeFollowedContent: true,
      followingClubUsernames: new Set(["followed-club"]),
      followingUsernames: new Set(["followed-user"]),
      items: [
        {
          id: "album-followed",
          username: "followed-user",
        },
        {
          clubUsername: "followed-club",
          id: "album-followed-club",
          username: "another-user",
        },
        {
          id: "album-blocked",
          username: "blocked-user",
        },
      ] as any,
      viewerIdentity,
    });

    expect(items.map((item) => item.id)).toEqual([]);
  });

  it("hides followed and self user results in non-mock mode", () => {
    const items = filterSearchUsers({
      blockedSet: new Set(["blocked-user"]),
      excludeFollowedContent: true,
      followingUsernames: new Set(["followed-user"]),
      items: [
        {
          id: "viewer-id",
          username: "viewer",
        },
        {
          id: "user-followed",
          username: "followed-user",
        },
        {
          id: "user-blocked",
          username: "blocked-user",
        },
      ] as any,
      viewerIdentity,
    });

    expect(items.map((item) => item.id)).toEqual([]);
  });

  it("still applies self and follow filtering", () => {
    const items = filterSearchUsers({
      blockedSet: new Set<string>(),
      excludeFollowedContent: true,
      followingUsernames: new Set(["followed-user"]),
      items: [
        {
          id: "viewer-id",
          username: "someone-else",
        },
        {
          id: "user-followed",
          username: "followed-user",
        },
        {
          id: "user-visible",
          username: "visible-user",
        },
      ] as any,
      viewerIdentity,
    });

    expect(items.map((item) => item.id)).toEqual(["user-visible"]);
  });

  it("keeps followed users visible when the screen is in explicit search mode", () => {
    const items = filterSearchUsers({
      blockedSet: new Set<string>(),
      excludeFollowedContent: false,
      followingUsernames: new Set(["followed-user"]),
      items: [
        {
          id: "user-followed",
          username: "followed-user",
        },
        {
          id: "user-visible",
          username: "visible-user",
        },
      ] as any,
      viewerIdentity,
    });

    expect(items.map((item) => item.id)).toEqual(["user-followed", "user-visible"]);
  });
});
