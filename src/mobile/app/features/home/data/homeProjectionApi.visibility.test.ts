import {
  setupHomeProjectionApiTestMocks,
  supabase,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed visibility hydration", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("hydrates missing home album surface flags from canonical album rows", async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const builder: {
        eq: jest.Mock;
        in: jest.Mock;
        is: jest.Mock;
        maybeSingle: jest.Mock;
        order: jest.Mock;
        select: jest.Mock;
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise<unknown>;
      } = {
        eq: jest.fn(),
        in: jest.fn(),
        is: jest.fn(),
        maybeSingle: jest.fn(),
        order: jest.fn(),
        select: jest.fn(),
        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.in.mockReturnValue(builder);
      builder.order.mockReturnValue(builder);
      builder.maybeSingle.mockResolvedValue({ data: null, error: null });
      builder.is.mockResolvedValue(
        table === "album_photos"
          ? {
              data: [
                {
                  id: "album-1",
                  show_on_club_profile: true,
                  show_on_profile: true,
                  show_on_user_profile: true,
                },
              ],
              error: null,
            }
          : { data: [], error: null },
      );
      return builder;
    });
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

    expect(result.items).toEqual([
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
        id: "album:album-1",
      }),
    ]);
  });
});
