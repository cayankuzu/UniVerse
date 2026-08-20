import {
  setupHomeProjectionApiTestMocks,
  supabase,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed projection visibility", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("trusts canonical projection surface flags without supplementary reads", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          actor: "student",
          album: {
            createdAt: "2026-03-18T09:00:00.000Z",
            eventId: "event-1",
            id: "album-1",
            showOnClubProfile: true,
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "student-a",
          },
          id: "album:album-1",
          kind: "album",
          sortDate: "2026-03-18T09:00:00.000Z",
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
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(supabase.from).not.toHaveBeenCalled();

    expect(result.items).toEqual([
      expect.objectContaining({
        album: expect.objectContaining({
          showOnClubProfile: true,
          showOnOwnProfile: true,
        }),
        homePresentation: expect.objectContaining({
          visibility: { text: "Kendim ve Kulüp", type: "club" },
        }),
        id: "album:album-1",
      }),
    ]);
  });
});
