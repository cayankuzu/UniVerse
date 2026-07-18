import {
  EventAPI,
  setupHomeProjectionApiTestMocks,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed student-attributed event filtering", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("drops student-attributed event cards from the home RPC envelope while keeping direct album content", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          actor: "student",
          event: {
            clubUsername: "club-b",
            feedActorType: "student",
            feedActorUsername: "followed-student",
            id: "event-student",
            startDate: "2026-03-15",
            title: "Student event leak",
          },
          id: "event:event-student",
          kind: "event",
          sortDate: "2026-03-15T10:00:00.000Z",
          source: "following",
        },
        {
          actor: "student",
          album: {
            clubUsername: "club-b",
            createdAt: "2026-03-15T11:00:00.000Z",
            eventId: "event-student",
            id: "album-student",
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "followed-student",
          },
          id: "album:album-student",
          kind: "album",
          sortDate: "2026-03-15T11:00:00.000Z",
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

    expect(result.items.map((item) => item.id)).toEqual(["album:album-student"]);
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
  });
});
