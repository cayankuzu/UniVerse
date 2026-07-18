import { mergeHomeFeedItemsById } from "./homeProjectionFallback";

describe("mergeHomeFeedItemsById", () => {
  it("keeps richer album visibility when a later supplement item is narrower", () => {
    const result = mergeHomeFeedItemsById(
      [
        {
          actor: "student",
          album: {
            createdAt: "2026-03-31T08:00:00.000Z",
            id: "album-1",
            showOnClubProfile: true,
            showOnOwnProfile: true,
            showOnProfile: true,
            surfaceVisibility: {
              label: { text: "Kendim ve Kulüp", type: "club" },
              showOnClubProfile: true,
              showOnOwnProfile: true,
              showOnProfile: true,
            },
            username: "viewer",
          },
          id: "album:album-1",
          kind: "album",
          sortDate: "2026-03-31T08:00:00.000Z",
          source: "own",
        } as any,
      ],
      [
        {
          actor: "student",
          album: {
            createdAt: "2026-03-31T08:00:00.000Z",
            id: "album-1",
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            surfaceVisibility: {
              label: { text: "Kendim", type: "own" },
              showOnClubProfile: false,
              showOnOwnProfile: true,
              showOnProfile: true,
            },
            username: "viewer",
          },
          id: "album:album-1",
          kind: "album",
          sortDate: "2026-03-31T08:00:00.000Z",
          source: "own",
        } as any,
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({
        album: expect.objectContaining({
          showOnClubProfile: true,
          showOnOwnProfile: true,
          surfaceVisibility: expect.objectContaining({
            label: { text: "Kendim ve Kulüp", type: "club" },
            showOnClubProfile: true,
            showOnOwnProfile: true,
          }),
        }),
      }),
    ]);
  });
});
