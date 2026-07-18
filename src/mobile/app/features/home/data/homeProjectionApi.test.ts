import {
  AlbumAPI,
  EventAPI,
  fetchEventsFromRpc,
  getLocalEventShadowByClubUserId,
  setupHomeProjectionApiTestMocks,
  supabase,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("filters blocked actors out of the home RPC envelope without falling back", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          actor: "student",
          event: {
            clubUsername: "club-a",
            id: "event-1",
            startDate: "2026-03-14",
            title: "Projection event",
          },
          id: "event:event-1",
          kind: "event",
          sortDate: "2026-03-14T10:00:00.000Z",
          source: "following",
        },
        {
          actor: "club",
          event: {
            clubUsername: "club-b",
            id: "event-2",
            startDate: "2026-03-15",
            title: "Visible event",
          },
          id: "event:event-2",
          kind: "event",
          sortDate: "2026-03-15T10:00:00.000Z",
          source: "following",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getHomeFeed({
      blockedUsernames: ["club-a"],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "events",
      viewerAccountType: "student",
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("event:event-2");
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
    expect(EventAPI.getByClub).not.toHaveBeenCalled();
    expect(AlbumAPI.getVisibleByEventIds).not.toHaveBeenCalled();
  });

  it("stays projection-first when the home RPC is unavailable", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (EventAPI.getHomeFeed as jest.Mock).mockResolvedValue([
      {
        clubUsername: "followed-club",
        createdAt: "2026-03-18T08:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "followed-club",
        feedSource: "following_club",
        id: "event-1",
        title: "Fallback event",
      },
    ]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([
      {
        clubUsername: "followed-club",
        createdAt: "2026-03-18T09:00:00.000Z",
        eventId: "event-1",
        id: "album-1",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
        username: "followed-club",
      },
    ]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual(["album:album-1", "event:event-1"]);
    expect(EventAPI.getHomeFeed).toHaveBeenCalledTimes(1);
    expect(AlbumAPI.getVisibleByEventIds).toHaveBeenCalledWith(["event-1"]);
  });

  it("recovers from an empty initial home RPC envelope with the SQL fallback feed", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (EventAPI.getHomeFeed as jest.Mock).mockResolvedValue([
      {
        clubUsername: "followed-club",
        createdAt: "2026-03-18T08:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "followed-club",
        feedSource: "following_club",
        id: "event-1",
        title: "Recovered event",
      },
    ]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([
      {
        clubUsername: "followed-club",
        createdAt: "2026-03-18T09:00:00.000Z",
        eventId: "event-1",
        id: "album-1",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
        username: "followed-club",
      },
    ]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual(["album:album-1", "event:event-1"]);
    expect(EventAPI.getHomeFeed).toHaveBeenCalledTimes(1);
    expect(AlbumAPI.getVisibleByEventIds).toHaveBeenCalledWith(["event-1"]);
  });

  it("filters blocked actors out of the home fallback envelope", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        { direction: "outgoing", user_id: "club-blocked", username: "blocked-club" },
        { direction: "incoming", user_id: "user-blocked", username: "blocked-student" },
      ],
      error: null,
    });
    (EventAPI.getHomeFeed as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-blocked",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T08:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "blocked-club",
        feedSource: "following_club",
        id: "event-blocked",
        title: "Blocked event",
      },
      {
        clubUserId: "club-visible",
        clubUsername: "visible-club",
        createdAt: "2026-03-18T09:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "visible-club",
        feedSource: "following_club",
        id: "event-visible",
        title: "Visible event",
      },
    ]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-blocked",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T09:30:00.000Z",
        eventId: "event-blocked",
        id: "album-blocked",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
        userId: "user-blocked",
        username: "blocked-student",
      },
      {
        clubUserId: "club-visible",
        clubUsername: "visible-club",
        createdAt: "2026-03-18T10:00:00.000Z",
        eventId: "event-visible",
        id: "album-visible",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
        userId: "user-visible",
        username: "visible-student",
      },
    ]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerId: "viewer-blocked",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual(["event:event-visible"]);
  });

  it("uses the direct viewer-id home event RPC before the auth-scoped fallback", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (fetchEventsFromRpc as jest.Mock).mockResolvedValue([
      {
        clubUsername: "followed-club",
        createdAt: "2026-03-18T08:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "followed-club",
        feedSource: "following_club",
        id: "event-1",
        title: "Direct RPC event",
      },
    ]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual(["event:event-1"]);
    expect(fetchEventsFromRpc).toHaveBeenCalledWith("list_home_feed_events_for_viewer", {
      target_viewer_id: "viewer-1",
    });
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
  });

  it("does not load followed-profile supplements during the initial home fetch", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (EventAPI.getHomeFeed as jest.Mock).mockResolvedValue([]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(result.items).toEqual([]);
    expect(EventAPI.getProfileEvents).not.toHaveBeenCalled();
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("viewer");
  });

  it("does not invoke the legacy fallback for empty incremental home RPC envelopes", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-2",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getHomeFeed(
      {
        blockedUsernames: [],
        entityFilter: "all",
        sortOption: "newest",
        sourceFilter: "all",
        typeFilter: "all",
        viewerAccountType: "student",
        viewerId: "viewer-1",
        viewerUsername: "viewer",
      },
      { deltaToken: "delta-1", since: "2026-03-18T00:00:00.000Z" },
    );

    expect(result.items).toEqual([]);
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
    expect(AlbumAPI.getVisibleByEventIds).not.toHaveBeenCalled();
  });

  it("keeps incremental refresh fallback delta-only when the home RPC times out", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);

    const result = await getHomeFeed(
      {
        blockedUsernames: [],
        entityFilter: "all",
        sortOption: "newest",
        sourceFilter: "all",
        typeFilter: "all",
        viewerAccountType: "student",
        viewerId: "viewer-1",
        viewerUsername: "viewer",
      },
      { deltaToken: "delta-1", since: "2026-03-18T00:00:00.000Z" },
    );

    expect(result.items).toEqual([]);
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
    expect(EventAPI.getByClub).not.toHaveBeenCalled();
    expect(AlbumAPI.getVisibleByEventIds).not.toHaveBeenCalled();
  });

  it("keeps optimistic own-club events visible alongside projection rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          actor: "club",
          event: {
            access: "Açık",
            clubUsername: "club-a",
            createdAt: "2026-03-18T08:00:00.000Z",
            id: "event-server",
            location: "Campus",
            startDate: "2026-03-18",
            title: "Server event",
          },
          id: "event:event-server",
          kind: "event",
          sortDate: "2026-03-18T08:00:00.000Z",
          source: "following",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (getLocalEventShadowByClubUserId as jest.Mock).mockResolvedValue([
      {
        clubUserId: "viewer-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T09:30:00.000Z",
        id: "temp-event:1",
        title: "Optimistic event",
        uploadStatus: "pending",
      },
    ]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "club",
      viewerId: "viewer-1",
      viewerUsername: "club-a",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "event:temp-event:1",
      "event:event-server",
    ]);
  });

  it("keeps optimistic own-club events visible on the following surface", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          actor: "club",
          event: {
            access: "Açık",
            clubUsername: "club-b",
            createdAt: "2026-03-18T08:00:00.000Z",
            id: "event-followed",
            location: "Campus",
            startDate: "2026-03-18",
            title: "Followed event",
          },
          id: "event:event-followed",
          kind: "event",
          sortDate: "2026-03-18T08:00:00.000Z",
          source: "following",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (getLocalEventShadowByClubUserId as jest.Mock).mockResolvedValue([
      {
        clubUserId: "viewer-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T09:30:00.000Z",
        id: "temp-event:1",
        title: "Optimistic own event",
        uploadStatus: "pending",
      },
    ]);

    const result = await getHomeFeed({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "following",
      typeFilter: "all",
      viewerAccountType: "club",
      viewerId: "viewer-1",
      viewerUsername: "club-a",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "event:temp-event:1",
      "event:event-followed",
    ]);
  });
});
