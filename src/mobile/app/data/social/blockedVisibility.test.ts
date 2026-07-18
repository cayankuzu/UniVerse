import {
  filterBlockedAlbums,
  getBlockedAlbumEventWarning,
  getBlockedEventAlbumWarning,
  filterBlockedEvents,
  filterBlockedHomeFeedItems,
  filterBlockedProfiles,
  filterBlockedComments,
  filterBlockedSearchUsers,
  filterBlockedUserIds,
  isBlockedProfile,
  loadViewerBlockedVisibility,
  replaceViewerBlockedVisibility,
} from "./blockedVisibility";

const mockGetBlocked = jest.fn();
const mockReadAuthenticatedUserId = jest.fn();
const mockRpc = jest.fn();

jest.mock("./social.block", () => ({
  BlockAPI: {
    getBlocked: (...args: unknown[]) => mockGetBlocked(...args),
  },
}));

jest.mock("./social.helpers", () => ({
  readAuthenticatedUserId: (...args: unknown[]) => mockReadAuthenticatedUserId(...args),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe("blockedVisibility", () => {
  beforeEach(() => {
    mockGetBlocked.mockReset();
    mockReadAuthenticatedUserId.mockReset();
    mockRpc.mockReset();
  });

  it("loads outgoing and incoming blocked ids and usernames for the active viewer", async () => {
    mockReadAuthenticatedUserId.mockResolvedValue("viewer-1");
    mockRpc.mockResolvedValue({
      data: [
        { direction: "outgoing", user_id: "user-1", username: "alice" },
        { direction: "incoming", user_id: "user-2", username: "bob" },
      ],
      error: null,
    });

    const snapshot = await loadViewerBlockedVisibility();

    expect(snapshot.viewerId).toBe("viewer-1");
    expect(snapshot.blockedIds.has("user-1")).toBe(true);
    expect(snapshot.blockedIds.has("user-2")).toBe(true);
    expect(snapshot.blockedUsernames.has("alice")).toBe(true);
    expect(snapshot.blockedUsernames.has("bob")).toBe(true);
  });

  it("filters blocked ids and usernames from comments and people lists", () => {
    const snapshot = {
      blockedIds: new Set(["user-2"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    };

    expect(filterBlockedUserIds(["user-1", "user-2", "user-3"], snapshot)).toEqual([
      "user-1",
      "user-3",
    ]);

    expect(
      filterBlockedComments(
        [
          { id: "comment-1", userId: "user-1", username: "visible-user" },
          { id: "comment-2", userId: "user-2", username: "blocked-user" },
        ],
        snapshot,
      ),
    ).toEqual([{ id: "comment-1", userId: "user-1", username: "visible-user" }]);

    expect(
      filterBlockedSearchUsers(
        [
          { id: "user-1", username: "visible-user" },
          { id: "user-9", username: "blocked-user" },
        ] as any,
        snapshot,
      ),
    ).toEqual([{ id: "user-1", username: "visible-user" }]);

    expect(
      filterBlockedProfiles(
        [
          { id: "user-1", username: "visible-user" },
          { id: "user-2", username: "someone-else" },
          { id: "user-3", username: "blocked-user" },
        ],
        snapshot,
      ),
    ).toEqual([{ id: "user-1", username: "visible-user" }]);
  });

  it("matches blocked profiles by either id or username", () => {
    const snapshot = {
      blockedIds: new Set(["user-2"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    };

    expect(isBlockedProfile(snapshot, { userId: "user-2", username: "someone-else" })).toBe(true);
    expect(isBlockedProfile(snapshot, { userId: "user-3", username: "blocked-user" })).toBe(true);
    expect(isBlockedProfile(snapshot, { userId: "user-3", username: "visible-user" })).toBe(false);
  });

  it("filters blocked albums, events, and home feed items", () => {
    const snapshot = {
      blockedIds: new Set(["club-2", "user-2"]),
      blockedUsernames: new Set(["blocked-club", "blocked-student"]),
      viewerId: "viewer-1",
    };

    expect(
      filterBlockedEvents(
        [
          { clubUserId: "club-1", clubUsername: "visible-club", id: "event-1" },
          { clubUserId: "club-2", clubUsername: "visible-club", id: "event-2" },
        ] as any,
        snapshot,
      ),
    ).toEqual([{ clubUserId: "club-1", clubUsername: "visible-club", id: "event-1" }]);

    expect(
      filterBlockedAlbums(
        [
          {
            clubUsername: "visible-club",
            id: "album-1",
            userId: "user-1",
            username: "visible-student",
          },
          {
            clubUsername: "blocked-club",
            id: "album-2",
            userId: "user-1",
            username: "visible-student",
          },
        ] as any,
        snapshot,
      ),
    ).toEqual([
      {
        clubUsername: "visible-club",
        id: "album-1",
        userId: "user-1",
        username: "visible-student",
      },
    ]);

    expect(
      filterBlockedAlbums(
        [
          { clubUsername: "blocked-club", id: "album-2", userId: "viewer-1", username: "viewer" },
          { clubUsername: "blocked-club", id: "album-3", userId: "user-9", username: "student-9" },
        ] as any,
        snapshot,
        {
          preserveViewerOwned: true,
          viewerId: "viewer-1",
          viewerUsername: "viewer",
        },
      ),
    ).toEqual([
      { clubUsername: "blocked-club", id: "album-2", userId: "viewer-1", username: "viewer" },
    ]);

    expect(
      filterBlockedHomeFeedItems(
        [
          {
            event: { clubUserId: "club-1", clubUsername: "visible-club", id: "event-1" },
            id: "event:event-1",
            kind: "event",
          },
          {
            album: {
              clubUsername: "visible-club",
              id: "album-2",
              userId: "user-2",
              username: "blocked-student",
            },
            id: "album:album-2",
            kind: "album",
          },
        ] as any,
        snapshot,
      ),
    ).toEqual([
      {
        event: { clubUserId: "club-1", clubUsername: "visible-club", id: "event-1" },
        id: "event:event-1",
        kind: "event",
      },
    ]);
  });

  it("returns a club-specific warning when album event navigation targets a blocked club", () => {
    const snapshot = {
      blockedIds: new Set(["club-2"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    };

    expect(
      getBlockedAlbumEventWarning(snapshot, {
        clubUserId: "club-2",
        clubUsername: "visible-club",
        userId: "user-1",
        username: "visible-student",
      } as any),
    ).toBe("Bu kulübü engellediğiniz için etkinlik kartı gösterilemiyor.");
  });

  it("returns a user-specific warning when album event navigation targets a blocked uploader", () => {
    const snapshot = {
      blockedIds: new Set(["user-9"]),
      blockedUsernames: new Set(["blocked-student"]),
      viewerId: "viewer-1",
    };

    expect(
      getBlockedAlbumEventWarning(snapshot, {
        clubUserId: "club-1",
        clubUsername: "visible-club",
        userId: "user-9",
        username: "visible-student",
      } as any),
    ).toBe("Bu kullanıcıyı engellediğiniz için etkinlik kartı gösterilemiyor.");
  });

  it("returns a club-specific warning when event album navigation targets a blocked club", () => {
    const snapshot = {
      blockedIds: new Set(["club-2"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    };

    expect(
      getBlockedEventAlbumWarning(snapshot, {
        clubUserId: "club-2",
        clubUsername: "visible-club",
        feedActorUsername: "visible-student",
      } as any),
    ).toBe("Bu kulübü engellediğiniz için albüm gösterilemiyor.");
  });

  it("returns a user-specific warning when event album navigation targets a blocked student", () => {
    const snapshot = {
      blockedIds: new Set(["user-9"]),
      blockedUsernames: new Set(["blocked-student"]),
      viewerId: "viewer-1",
    };

    expect(
      getBlockedEventAlbumWarning(snapshot, {
        clubUserId: "club-1",
        clubUsername: "visible-club",
        feedActorUsername: "blocked-student",
      } as any),
    ).toBe("Bu kullanıcıyı engellediğiniz için albüm gösterilemiyor.");
  });

  it("keeps incoming blockers cached while replacing outgoing visibility immediately", async () => {
    mockRpc.mockResolvedValue({
      data: [{ direction: "incoming", user_id: "user-2", username: "incoming-user" }],
      error: null,
    });

    await loadViewerBlockedVisibility("viewer-cache");

    replaceViewerBlockedVisibility({
      ids: ["user-9"],
      usernames: ["cache-user"],
      viewerId: "viewer-cache",
    });

    const snapshot = await loadViewerBlockedVisibility("viewer-cache");

    expect(snapshot.blockedIds.has("user-9")).toBe(true);
    expect(snapshot.blockedUsernames.has("cache-user")).toBe(true);
    expect(snapshot.blockedIds.has("user-2")).toBe(true);
    expect(snapshot.blockedUsernames.has("incoming-user")).toBe(true);
  });

  it("falls back to outgoing block reads when the snapshot rpc is unavailable", async () => {
    mockReadAuthenticatedUserId.mockResolvedValue("viewer-fallback");
    mockRpc.mockResolvedValue({ data: null, error: new Error("rpc unavailable") });
    mockGetBlocked.mockResolvedValue([{ userId: "user-7", username: "fallback-user" }]);

    const snapshot = await loadViewerBlockedVisibility();

    expect(mockGetBlocked).toHaveBeenCalledTimes(1);
    expect(snapshot.blockedIds.has("user-7")).toBe(true);
    expect(snapshot.blockedUsernames.has("fallback-user")).toBe(true);
  });
});
