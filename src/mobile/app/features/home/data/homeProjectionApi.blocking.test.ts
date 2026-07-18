import {
  AlbumAPI,
  setupHomeProjectionApiTestMocks,
  supabase,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed blocked visibility", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("keeps viewer-owned blocked club albums on home when the viewer has block relations", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-own-1",
      items: [
        {
          actor: "club",
          event: {
            clubUsername: "visible-club",
            createdAt: "2026-03-15T10:00:00.000Z",
            id: "event-visible",
            startDate: "2026-03-15",
            title: "Visible event",
          },
          id: "event:event-visible",
          kind: "event",
          sortDate: "2026-03-15T10:00:00.000Z",
          source: "following",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [{ direction: "outgoing", user_id: "club-blocked", username: "blocked-club" }],
      error: null,
    });
    (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([
      {
        clubUserId: "club-blocked",
        clubUsername: "blocked-club",
        createdAt: "2026-03-18T11:00:00.000Z",
        eventId: "event-blocked",
        id: "album-owned",
        showOnOwnProfile: true,
        showOnProfile: true,
        userId: "viewer-blocked",
        username: "viewer",
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

    expect(result.items.map((item) => item.id)).toEqual([
      "album:album-owned",
      "event:event-visible",
    ]);
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("viewer");
  });
});
