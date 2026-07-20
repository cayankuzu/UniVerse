import { estimateProfilePagerHeights } from "./profilePagerLayout";

describe("estimateProfilePagerHeights", () => {
  it("uses a stable empty-page height", () => {
    expect(
      estimateProfilePagerHeights({
        cardHeight: 196,
        hasMore: false,
        numColumns: 2,
        rowGap: 8,
        tabs: { album: [], events: [] },
      }),
    ).toEqual({ album: 296, events: 296 });
  });

  it("includes rows, gaps, footer and safety padding", () => {
    const item = (id: string) => ({ id }) as any;
    expect(
      estimateProfilePagerHeights({
        cardHeight: 100,
        hasMore: true,
        numColumns: 2,
        rowGap: 10,
        tabs: {
          album: [item("1"), item("2"), item("3")],
          events: [item("4")],
        },
      }),
    ).toEqual({ album: 304, events: 194 });
  });
});
