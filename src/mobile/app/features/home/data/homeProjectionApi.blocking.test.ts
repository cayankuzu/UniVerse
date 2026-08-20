import {
  AlbumAPI,
  setupHomeProjectionApiTestMocks,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed projection authority", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("does not append rollback-only album reads to a successful projection", async () => {
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
    expect(AlbumAPI.getPhotos).not.toHaveBeenCalled();
  });
});
