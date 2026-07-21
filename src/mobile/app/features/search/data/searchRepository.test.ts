jest.mock("./searchProjectionApi", () => ({
  getSearchResults: jest.fn().mockResolvedValue({
    deletedIds: [],
    items: [],
    nextCursor: null,
    serverTime: "2026-07-20T00:00:00.000Z",
    updatedItems: [],
  }),
}));

import { getSearchResults } from "./searchProjectionApi";
import { fetchSearchResults, getSearchQueryDef } from "./searchRepository";

describe("getSearchQueryDef", () => {
  it("reuses the shared discovery scope for the default search landing", () => {
    const queryDef = getSearchQueryDef({
      kind: "albums",
      viewer: {
        id: "viewer-1",
        username: "viewer",
      },
    });

    expect(queryDef.queryKey).toEqual([
      "screen",
      "search",
      "albums",
      "viewer-1",
      "__discovery__:newest",
    ]);
  });

  it("cancels an obsolete request when a newer search starts", () => {
    const params = {
      kind: "albums" as const,
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    };

    void fetchSearchResults({ ...params, queryText: "first" });
    const firstSignal = (getSearchResults as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    void fetchSearchResults({ ...params, queryText: "second" });

    expect(firstSignal.aborted).toBe(true);
    expect((getSearchResults as jest.Mock).mock.calls[1][1].signal.aborted).toBe(false);
  });
});
