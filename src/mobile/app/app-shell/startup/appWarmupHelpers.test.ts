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
    notifications: { items: [{ userImage: "notification-user" }] },
    profileAlbums: { items: [{ cover_image_variants: { thumbnail: "album-thumb" } }] },
    profileEvents: { items: [{ clubImage: "club-image" }] },
    profileOverview: {
      overview: {
        profile: { profileImageVariants: { thumbnail: "profile-thumb" } },
      },
    },
    search: { content: { items: [{ image_variants: { thumbnail: "search-thumb" } }] } },
    searchDiscovery: {
      clubs: { items: [{ coverImageVariants: { thumbnail: "club-cover" } }] },
    },
  } as any;
}

describe("app warmup image helpers", () => {
  it("collects every projection surface with Home content first", () => {
    const bundle = createBundle();

    expect(collectWarmupBundleItems(bundle)).toHaveLength(7);
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
