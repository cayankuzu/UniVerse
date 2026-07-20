import { collectWarmupBundleItems, takeFreshWarmupImageUris } from "./appWarmupHelpers";

function createBundle() {
  return {
    home: {
      items: [
        {
          kind: "event",
          event: {
            imageVariants: { medium: "event-medium", thumbnail: "event-thumb" },
          },
        },
      ],
    },
  } as any;
}

describe("app warmup image helpers", () => {
  it("collects only first-fold Home content", () => {
    const bundle = createBundle();

    expect(collectWarmupBundleItems(bundle)).toHaveLength(1);
    expect(collectWarmupBundleItems(bundle)[0]).toEqual(bundle.home.items[0]);
  });

  it("deduplicates cache-equivalent warmup images across calls", () => {
    const seen = new Set<string>();
    const items = [
      { imageVariants: { thumbnail: "first" }, userImage: "fallback" },
      { album: { coverImageVariants: { thumbnail: "second" } } },
      null,
    ];

    expect(takeFreshWarmupImageUris(items, seen, 4)).toEqual(["first", "fallback", "second"]);
    expect(takeFreshWarmupImageUris(items, seen, 4)).toEqual([]);
    expect(takeFreshWarmupImageUris(items, seen, 0)).toEqual([]);
  });

  it("falls back to raw feed media when variants are unavailable", () => {
    expect(
      takeFreshWarmupImageUris(
        [
          { kind: "event", event: { image: "events/raw-cover.jpg" } },
          { kind: "album", album: { image: "albums/raw-photo.jpg" } },
        ],
        new Set(),
        4,
      ),
    ).toEqual(["events/raw-cover.jpg", "albums/raw-photo.jpg"]);
  });
});
