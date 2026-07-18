import { getSearchQueryDef } from "./searchRepository";

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
});
