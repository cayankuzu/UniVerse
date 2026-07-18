jest.mock("../content/albums.api", () => ({
  AlbumAPI: {
    getPhotoCommentLikes: jest.fn(),
    getPhotoLikes: jest.fn(),
  },
}));

jest.mock("../content/events.api", () => ({
  EventAPI: {
    getAttendees: jest.fn(),
    getCommentLikes: jest.fn(),
    getLikes: jest.fn(),
  },
}));

jest.mock("./projections.api.helpers", () => {
  const actual = jest.requireActual("./projections.api.helpers");
  return {
    ...actual,
    tryProjectionRpc: jest.fn(),
  };
});

jest.mock("../social/blockedVisibility", () => {
  const actual = jest.requireActual("../social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibility: jest.fn(),
  };
});

import { AlbumAPI } from "../content/albums.api";
import { EventAPI } from "../content/events.api";
import { loadViewerBlockedVisibility } from "../social/blockedVisibility";
import { tryProjectionRpc } from "./projections.api.helpers";
import { getAlbumPhotoLikersProjection, getEventAttendeesProjection } from "./projectionUsers";

describe("projectionUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadViewerBlockedVisibility as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["user-2"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    });
  });

  it("filters blocked attendees out of rpc envelopes", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        { id: "user-1", name: "Visible", username: "visible-user" },
        { id: "user-2", name: "Blocked", username: "blocked-user" },
      ],
      nextCursor: null,
      serverTime: "2026-03-29T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getEventAttendeesProjection({
      eventId: "event-1",
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({ id: "user-1", username: "visible-user" }),
    ]);
  });

  it("filters blocked likers out of fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (AlbumAPI.getPhotoLikes as jest.Mock).mockResolvedValue([
      { id: "user-1", name: "Visible", username: "visible-user" },
      { id: "user-2", name: "Blocked", username: "blocked-user" },
    ]);

    const result = await getAlbumPhotoLikersProjection({
      photoId: "photo-1",
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({ id: "user-1", username: "visible-user" }),
    ]);
    expect(EventAPI.getAttendees).not.toHaveBeenCalled();
  });
});
