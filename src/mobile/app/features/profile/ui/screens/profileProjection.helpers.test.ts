import { getProfileProjectionPrefetchTabs } from "../../application/profileCollections";

describe("profile projection helpers", () => {
  it("prefetches the inactive events tab when the overview count is non-zero", () => {
    expect(
      getProfileProjectionPrefetchTabs({
        activeTab: "album",
        albumsCount: 0,
        eventsCount: 2,
      }),
    ).toEqual(["events"]);
  });

  it("skips inactive tab prefetch when the overview counts are empty", () => {
    expect(
      getProfileProjectionPrefetchTabs({
        activeTab: "events",
        albumsCount: 0,
        eventsCount: 1,
      }),
    ).toEqual([]);
  });
});
