jest.mock("./homeProjectionApi", () => ({
  getHomeFeed: jest.fn(),
}));

import { getHomeFeed } from "./homeProjectionApi";
import { getHomeFeedQueryDef } from "./homeRepository";

describe("getHomeFeedQueryDef", () => {
  beforeEach(() => {
    (getHomeFeed as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-26T00:00:00.000Z",
      updatedItems: [],
    });
  });

  it("uses a 5-item first page and full page size for follow-up pages", async () => {
    const queryDef = getHomeFeedQueryDef({
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewer: {
        accountType: "student",
        id: "viewer-1",
        username: "viewer",
      },
    });

    await queryDef.fetchProjection({
      cursor: null,
      deltaToken: null,
      limit: 12,
      mode: "replace",
      since: null,
    });
    await queryDef.fetchProjection({
      cursor: "cursor-1",
      deltaToken: null,
      limit: 12,
      mode: "append",
      since: null,
    });

    expect(getHomeFeed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        viewerId: "viewer-1",
        viewerUsername: "viewer",
      }),
      expect.objectContaining({
        limit: 5,
      }),
    );
    expect(getHomeFeed).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        cursor: "cursor-1",
        limit: 12,
      }),
    );
  });
});
