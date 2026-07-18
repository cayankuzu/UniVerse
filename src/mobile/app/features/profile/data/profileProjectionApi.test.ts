jest.mock("../../../data/content", () => ({
  AlbumAPI: {
    getPhotos: jest.fn(),
  },
  EventAPI: {
    getProfileEvents: jest.fn(),
  },
  getLocalEventShadowByClubUsername: jest.fn(),
}));

jest.mock("../../../data/projections/projections.api.helpers", () => {
  const actual = jest.requireActual("../../../data/projections/projections.api.helpers");
  return {
    ...actual,
    shouldFallbackToLegacy: jest.fn(() => false),
    tryProjectionRpc: jest.fn(),
  };
});

jest.mock("../../../data/social/blockedVisibility", () => {
  const actual = jest.requireActual("../../../data/social/blockedVisibility");
  const loadViewerBlockedVisibilityMock = jest.fn();
  return {
    ...actual,
    loadViewerBlockedVisibility: loadViewerBlockedVisibilityMock,
    loadViewerBlockedVisibilityOrEmpty: loadViewerBlockedVisibilityMock,
  };
});

import { AlbumAPI, EventAPI, getLocalEventShadowByClubUsername } from "../../../data/content";
import { tryProjectionRpc } from "../../../data/projections/projections.api.helpers";
import { loadViewerBlockedVisibilityOrEmpty } from "../../../data/social/blockedVisibility";
import { getProfileContent, getProfileScreen } from "./profileProjectionApi";

describe("getProfileContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLocalEventShadowByClubUsername as jest.Mock).mockResolvedValue([]);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-1",
    });
  });

  it("falls back to direct profile event reads when the projection RPC is unavailable", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (EventAPI.getProfileEvents as jest.Mock).mockResolvedValue([
      {
        club: "Club A",
        clubImage: "",
        clubUserId: "club-user-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T10:00:00.000Z",
        date: "2026-03-18",
        id: "event-direct",
        title: "Direct profile event",
      },
    ]);

    const result = await getProfileContent("club-a", "events", "viewer-1");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual(["event-direct"]);
    expect(EventAPI.getProfileEvents).toHaveBeenCalledWith("club-a");
  });

  it("keeps optimistic local profile events visible on top of projection rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          club: "Club A",
          clubImage: "",
          clubUserId: "club-user-1",
          clubUsername: "club-a",
          createdAt: "2026-03-18T08:00:00.000Z",
          date: "2026-03-18",
          id: "event-server",
          title: "Server profile event",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (getLocalEventShadowByClubUsername as jest.Mock).mockResolvedValue([
      {
        club: "Club A",
        clubImage: "",
        clubUserId: "club-user-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T09:00:00.000Z",
        date: "2026-03-18",
        id: "temp-event:1",
        title: "Optimistic profile event",
        uploadStatus: "pending",
      },
    ]);

    const result = await getProfileContent("club-a", "events", "viewer-1", "club-a");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual([
      "temp-event:1",
      "event-server",
    ]);
    expect(AlbumAPI.getPhotos).not.toHaveBeenCalled();
  });

  it("does not merge optimistic local profile events into third-party viewed profiles", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1b",
      items: [
        {
          club: "Club A",
          clubImage: "",
          clubUserId: "club-user-1",
          clubUsername: "club-a",
          createdAt: "2026-03-18T08:00:00.000Z",
          date: "2026-03-18",
          id: "event-server",
          title: "Server profile event",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (getLocalEventShadowByClubUsername as jest.Mock).mockResolvedValue([
      {
        club: "Club A",
        clubImage: "",
        clubUserId: "club-user-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T09:00:00.000Z",
        date: "2026-03-18",
        id: "temp-event:1",
        title: "Optimistic profile event",
        uploadStatus: "pending",
      },
    ]);

    const result = await getProfileContent("club-a", "events", "viewer-1", "viewer-z");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual(["event-server"]);
  });

  it("normalizes wrapped profile event projection rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-2",
      items: [
        {
          albumCount: 3,
          event: {
            club: "Club A",
            clubImage: "",
            clubUserId: "club-user-1",
            clubUsername: "club-a",
            createdAt: "2026-03-18T08:00:00.000Z",
            date: "2026-03-18",
            id: "event-wrapped",
            title: "Wrapped profile event",
          },
          id: "event:event-wrapped",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getProfileContent("club-a", "events", "viewer-1");

    expect(result.items).toMatchObject([
      {
        albumCount: 3,
        id: "event-wrapped",
        title: "Wrapped profile event",
      },
    ]);
  });

  it("treats an empty profile event rpc page as authoritative and skips fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-3",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getProfileContent("club-a", "events", "viewer-1");

    expect(result.items).toEqual([]);
    expect(EventAPI.getProfileEvents).not.toHaveBeenCalled();
  });

  it("treats an empty profile album rpc page as authoritative and skips fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-4",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getProfileContent("club-a", "album", "viewer-1");

    expect(result.items).toEqual([]);
    expect(AlbumAPI.getPhotos).not.toHaveBeenCalled();
  });

  it("filters blocked club-linked albums out of direct profile album fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["club-user-2"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    });
    (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-user-2",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Blocked album event",
        id: "album-blocked",
        image: "https://example.com/album.jpg",
        images: ["https://example.com/album.jpg"],
        userId: "user-1",
        username: "student-a",
      },
      {
        clubUserId: "club-user-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T11:00:00.000Z",
        eventId: "event-2",
        eventTitle: "Visible album event",
        id: "album-visible",
        image: "https://example.com/album-2.jpg",
        images: ["https://example.com/album-2.jpg"],
        userId: "user-1",
        username: "student-a",
      },
    ]);

    const result = await getProfileContent("student-a", "album", "viewer-1");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual(["album-visible"]);
  });

  it("keeps viewer-owned blocked club-linked albums on the viewer's own profile", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["club-user-2"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    });
    (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-user-2",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Blocked album event",
        id: "album-blocked",
        image: "https://example.com/album.jpg",
        images: ["https://example.com/album.jpg"],
        userId: "viewer-1",
        username: "student-a",
      },
    ]);

    const result = await getProfileContent("student-a", "album", "viewer-1", "student-a");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual(["album-blocked"]);
  });

  it("keeps target-owned album cards visible for third-party profile viewers", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-z",
    });
    (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-user-2",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Visible target album",
        id: "album-target-visible",
        image: "https://example.com/album.jpg",
        images: ["https://example.com/album.jpg"],
        userId: "student-a-id",
        username: "student-a",
      },
    ]);

    const result = await getProfileContent("student-a", "album", "viewer-z", "viewer-z");

    expect(result.items.map((item) => (item as { id: string }).id)).toEqual([
      "album-target-visible",
    ]);
  });
});

describe("getProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLocalEventShadowByClubUsername as jest.Mock).mockResolvedValue([]);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-1",
    });
  });

  it("recovers club profile events during bootstrap when overview count is positive", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-screen-1",
      items: [
        {
          contentItems: [],
          id: "club-a",
          overview: {
            profile: {
              eventsCount: 2,
              username: "club-a",
            },
          },
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (EventAPI.getProfileEvents as jest.Mock).mockResolvedValue([
      {
        club: "Club A",
        clubImage: "",
        clubUserId: "club-user-1",
        clubUsername: "club-a",
        createdAt: "2026-03-18T10:00:00.000Z",
        date: "2026-03-18",
        id: "event-bootstrap",
        title: "Bootstrap profile event",
      },
    ]);

    const result = await getProfileScreen("club-a", "viewer-a", "events", "viewer-1");

    expect(result.content.items.map((item: any) => item.id)).toEqual(["event-bootstrap"]);
    expect(EventAPI.getProfileEvents).toHaveBeenCalledWith("club-a");
  });

  it("recovers profile albums during bootstrap when overview count is positive", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-screen-2",
      items: [
        {
          contentItems: [],
          id: "club-a",
          overview: {
            profile: {
              albumsCount: 1,
              username: "club-a",
            },
          },
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([
      {
        createdAt: "2026-03-18T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Recovered album event",
        id: "album-bootstrap",
        image: "https://example.com/album.jpg",
        images: ["https://example.com/album.jpg"],
        username: "club-a",
      },
    ]);

    const result = await getProfileScreen("club-a", "viewer-a", "album", "viewer-1");

    expect(result.content.items.map((item: any) => item.id)).toEqual(["album-bootstrap"]);
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("club-a");
  });

  it("keeps viewer-owned blocked club-linked albums during own profile bootstrap", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-screen-3",
      items: [
        {
          contentItems: [
            {
              clubUserId: "club-user-2",
              clubUsername: "blocked-club",
              createdAt: "2026-03-18T10:00:00.000Z",
              eventId: "event-1",
              eventTitle: "Blocked album event",
              id: "album-blocked",
              image: "https://example.com/album.jpg",
              images: ["https://example.com/album.jpg"],
              userId: "viewer-1",
              username: "student-a",
            },
          ],
          id: "student-a",
          overview: {
            profile: {
              albumsCount: 1,
              username: "student-a",
            },
          },
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["club-user-2"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    });

    const result = await getProfileScreen("student-a", "student-a", "album", "viewer-1");

    expect(result.content.items.map((item: any) => item.id)).toEqual(["album-blocked"]);
  });
});
