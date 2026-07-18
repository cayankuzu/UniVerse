jest.mock("../content/albums.api", () => ({
  AlbumAPI: {
    getEventPhotos: jest.fn(),
  },
}));

jest.mock("../content/events.api", () => ({
  EventAPI: {
    getById: jest.fn(),
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

jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(() => {
      const builder = {
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: [], error: null }),
        select: jest.fn().mockReturnThis(),
      };
      return builder;
    }),
  },
}));

import { AlbumAPI } from "../content/albums.api";
import { EventAPI } from "../content/events.api";
import { loadViewerBlockedVisibility } from "../social/blockedVisibility";
import { supabase } from "../../platform/supabase";
import { tryProjectionRpc } from "./projections.api.helpers";
import { getAlbumEventProjection, getEventDetailProjection } from "./projectionDetails";

const VALID_EVENT_ID = "11111111-1111-4111-8111-111111111111";

describe("projectionDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadViewerBlockedVisibility as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["club-2", "user-2"]),
      blockedUsernames: new Set(["blocked-club", "blocked-student"]),
      viewerId: "viewer-1",
    });
  });

  it("hides blocked event details during fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (EventAPI.getById as jest.Mock).mockResolvedValue({
      clubUserId: "club-2",
      clubUsername: "blocked-club",
      id: "event-1",
      title: "Blocked event",
    });

    const result = await getEventDetailProjection({
      eventId: VALID_EVENT_ID,
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([]);
  });

  it("filters blocked album owners out of rpc album-event envelopes", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          club_username: "visible-club",
          event_id: "event-1",
          event_title: "Visible event",
          photo_id: "photo-1",
          show_on_club_profile: false,
          show_on_profile: true,
          show_on_user_profile: false,
          storage_path: "albums/photo-1.jpg",
          uploader_id: "user-1",
          uploader_name: "Visible",
          uploader_username: "visible-user",
        },
        {
          club_username: "visible-club",
          event_id: "event-1",
          event_title: "Blocked event",
          photo_id: "photo-2",
          storage_path: "albums/photo-2.jpg",
          uploader_id: "user-2",
          uploader_name: "Blocked",
          uploader_username: "blocked-student",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-29T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getAlbumEventProjection({
      eventId: VALID_EVENT_ID,
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "photo-1",
        showOnClubProfile: false,
        showOnOwnProfile: false,
        showOnProfile: true,
        surfaceVisibility: {
          label: { text: "Kendim", type: "own" },
          showOnClubProfile: false,
          showOnOwnProfile: false,
          showOnProfile: true,
        },
        username: "visible-user",
      }),
    ]);
    expect(AlbumAPI.getEventPhotos).not.toHaveBeenCalled();
  });

  it("hydrates missing album-event surface flags from canonical album rows", async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      const builder = {
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({
          data: [
            {
              id: "photo-1",
              show_on_club_profile: true,
              show_on_profile: true,
              show_on_user_profile: true,
            },
          ],
          error: null,
        }),
        select: jest.fn().mockReturnThis(),
      };
      return builder;
    });
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          club_username: "visible-club",
          event_id: "event-1",
          event_title: "Visible event",
          photo_id: "photo-1",
          show_on_profile: true,
          storage_path: "albums/photo-1.jpg",
          uploader_id: "user-1",
          uploader_name: "Visible",
          uploader_username: "visible-user",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-29T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getAlbumEventProjection({
      eventId: VALID_EVENT_ID,
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "photo-1",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
        surfaceVisibility: expect.objectContaining({
          label: { text: "Kendim ve Kulüp", type: "club" },
          showOnClubProfile: true,
          showOnOwnProfile: true,
        }),
      }),
    ]);
  });

  it("treats an empty album-event rpc page as authoritative and skips fallback reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-empty",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-29T00:00:00.000Z",
      updatedItems: [],
    });

    const result = await getAlbumEventProjection({
      eventId: VALID_EVENT_ID,
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([]);
    expect(AlbumAPI.getEventPhotos).not.toHaveBeenCalled();
  });
});
