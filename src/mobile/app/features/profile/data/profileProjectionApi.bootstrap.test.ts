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
import { getProfileScreen } from "./profileProjectionApi";

describe("getProfileScreen bootstrap fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLocalEventShadowByClubUsername as jest.Mock).mockResolvedValue([]);
    (loadViewerBlockedVisibilityOrEmpty as jest.Mock).mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-1",
    });
  });

  it("recovers profile albums during bootstrap even when overview count is stale zero", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-screen-4",
      items: [
        {
          contentItems: [],
          id: "club-a",
          overview: { profile: { albumsCount: 0, username: "club-a" } },
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
        id: "album-bootstrap-zero",
        image: "https://example.com/album.jpg",
        images: ["https://example.com/album.jpg"],
        username: "club-a",
      },
    ]);

    const result = await getProfileScreen("club-a", "viewer-a", "album", "viewer-1");

    expect(result.content.items.map((item: any) => item.id)).toEqual(["album-bootstrap-zero"]);
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("club-a");
  });

  it("recovers profile events during bootstrap even when overview count is stale zero", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-screen-5",
      items: [
        {
          contentItems: [],
          id: "club-a",
          overview: { profile: { eventsCount: 0, username: "club-a" } },
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
        id: "event-bootstrap-zero",
        title: "Bootstrap profile event",
      },
    ]);

    const result = await getProfileScreen("club-a", "viewer-a", "events", "viewer-1");

    expect(result.content.items.map((item: any) => item.id)).toEqual(["event-bootstrap-zero"]);
    expect(EventAPI.getProfileEvents).toHaveBeenCalledWith("club-a");
  });
});
