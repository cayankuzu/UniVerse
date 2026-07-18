jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));

jest.mock("./albums.shared", () => ({
  listProfileVisibleAlbums: jest.fn(),
  listVisibleAlbums: jest.fn(),
  matchesProfileAlbumSurface: jest.fn(() => true),
  mergeAlbumCollections: jest.fn((...collections: unknown[][]) => collections.flat()),
  normalizeAlbumLookupValue: jest.fn((value: unknown) =>
    String(value || "")
      .trim()
      .toLowerCase(),
  ),
  resolveProfileAccountType: jest.fn(),
}));

jest.mock("./albums.table", () => ({
  fetchClubProfilePhotosFromTable: jest.fn(),
  fetchEventPhotosFromTable: jest.fn(),
  fetchFeedPhotosFromTable: jest.fn(),
  fetchProfilePhotosFromTable: jest.fn(),
}));

jest.mock("./albums.local", () => ({
  getLocalAlbumShadowByEventIds: jest.fn(),
  getLocalAlbumShadowFeed: jest.fn(),
  getLocalAlbumShadowForProfile: jest.fn(),
  registerAlbumLocalShadowMutation: jest.fn(),
}));

jest.mock("./albums.visibility", () => ({
  finalizeAlbumResult: jest.fn(async (items: unknown[]) => items),
}));

import { albumReads, resetAlbumReadCachesForTests } from "./albums.reads";

const { supabase } = jest.requireMock("../../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
    };
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { resolveProfileIdByUsername } = jest.requireMock("../../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

const { listVisibleAlbums, listProfileVisibleAlbums, resolveProfileAccountType } = jest.requireMock(
  "./albums.shared",
) as {
  listVisibleAlbums: jest.Mock;
  listProfileVisibleAlbums: jest.Mock;
  resolveProfileAccountType: jest.Mock;
};

const { fetchFeedPhotosFromTable, fetchProfilePhotosFromTable } = jest.requireMock(
  "./albums.table",
) as {
  fetchFeedPhotosFromTable: jest.Mock;
  fetchProfilePhotosFromTable: jest.Mock;
};

const { getLocalAlbumShadowForProfile } = jest.requireMock("./albums.local") as {
  getLocalAlbumShadowForProfile: jest.Mock;
};

describe("albumReads.getPhotos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    resetAlbumReadCachesForTests();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });

    const profileBuilder = {
      eq: jest.fn(),
      is: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { account_type: "student", username: "viewer" },
        error: null,
      }),
      select: jest.fn(),
    };
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue(profileBuilder);
    profileBuilder.is.mockReturnValue(profileBuilder);

    supabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profileBuilder;
      }
      return {
        eq: jest.fn(),
        is: jest.fn(),
        maybeSingle: jest.fn(),
        select: jest.fn(),
      };
    });

    getLocalAlbumShadowForProfile.mockResolvedValue([]);
    listVisibleAlbums.mockResolvedValue(null);
    fetchFeedPhotosFromTable.mockResolvedValue([]);
    listProfileVisibleAlbums.mockResolvedValue(null);
    resolveProfileAccountType.mockResolvedValue(null);
    fetchProfilePhotosFromTable.mockResolvedValue([]);
  });

  it("uses the authenticated viewer id when resolving the viewer's own username fails", async () => {
    resolveProfileIdByUsername.mockResolvedValue(null);
    fetchProfilePhotosFromTable.mockResolvedValue([
      {
        clubUsername: "blocked-club",
        id: "album-1",
        showOnOwnProfile: true,
        username: "viewer",
        userId: "viewer-id",
      },
    ]);

    const result = await albumReads.getPhotos("viewer");

    expect(fetchProfilePhotosFromTable).toHaveBeenCalledWith("viewer", "viewer-id");
    expect(result).toEqual([
      expect.objectContaining({
        id: "album-1",
        username: "viewer",
        userId: "viewer-id",
      }),
    ]);
  });

  it("treats an empty profile album rpc as authoritative and skips table fallback", async () => {
    resolveProfileIdByUsername.mockResolvedValue("student-id");
    listProfileVisibleAlbums.mockResolvedValue([]);
    fetchProfilePhotosFromTable.mockResolvedValue([
      {
        clubUsername: "blocked-club",
        id: "album-leak",
        showOnOwnProfile: true,
        username: "student-a",
        userId: "student-id",
      },
    ]);

    const result = await albumReads.getPhotos("student-a");

    expect(result).toEqual([]);
    expect(fetchProfilePhotosFromTable).not.toHaveBeenCalled();
  });

  it("does not leak local profile album shadow into third-party profile reads", async () => {
    resolveProfileIdByUsername.mockResolvedValue("student-id");
    getLocalAlbumShadowForProfile.mockResolvedValue([
      {
        clubUsername: "blocked-club",
        id: "album-shadow",
        showOnOwnProfile: true,
        username: "student-a",
        userId: "student-id",
      },
    ]);
    listProfileVisibleAlbums.mockResolvedValue([]);

    const result = await albumReads.getPhotos("student-a");

    expect(result).toEqual([]);
  });

  it("keeps local profile album shadow on the viewer's own profile", async () => {
    resolveProfileIdByUsername.mockResolvedValue(null);
    getLocalAlbumShadowForProfile.mockResolvedValue([
      {
        id: "album-shadow",
        showOnOwnProfile: true,
        username: "viewer",
        userId: "viewer-id",
      },
    ]);
    listProfileVisibleAlbums.mockResolvedValue([]);

    const result = await albumReads.getPhotos("viewer");

    expect(result).toEqual([
      expect.objectContaining({
        id: "album-shadow",
        username: "viewer",
        userId: "viewer-id",
      }),
    ]);
  });

  it("keeps preserved albums from deleted club events on the uploader profile", async () => {
    resolveProfileIdByUsername.mockResolvedValue("student-id");
    fetchProfilePhotosFromTable.mockResolvedValue([
      {
        canOpenAlbum: true,
        canOpenAlbumEventDetail: false,
        eventId: "",
        eventTitle: "Silinen Etkinlik",
        id: "album-preserved",
        lockedReasonCode: "EVENT_REMOVED",
        lockedReasonText: "Bu albümün bagli oldugu etkinlik artik mevcut degil.",
        showOnOwnProfile: true,
        username: "student-a",
        userId: "student-id",
      },
    ]);

    const result = await albumReads.getPhotos("student-a");

    expect(result).toEqual([
      expect.objectContaining({
        eventId: "",
        id: "album-preserved",
        lockedReasonCode: "EVENT_REMOVED",
      }),
    ]);
  });

  it("dedupes concurrent profile album reads for the same viewer and username", async () => {
    let resolveTableRead: ((value: unknown[]) => void) | undefined;
    resolveProfileIdByUsername.mockResolvedValue("student-id");
    fetchProfilePhotosFromTable.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTableRead = resolve;
        }),
    );

    const firstRead = albumReads.getPhotos("student-a");
    const secondRead = albumReads.getPhotos("student-a");

    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!resolveTableRead) {
      throw new Error("profile album table read did not start");
    }

    resolveTableRead([
      {
        id: "album-1",
        showOnOwnProfile: true,
        username: "student-a",
        userId: "student-id",
      },
    ]);

    await expect(Promise.all([firstRead, secondRead])).resolves.toEqual([
      [
        expect.objectContaining({
          id: "album-1",
        }),
      ],
      [
        expect.objectContaining({
          id: "album-1",
        }),
      ],
    ]);

    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fetchProfilePhotosFromTable).toHaveBeenCalledTimes(1);
  });

  it("falls back quickly to limited search table rows when the search rpc stalls", async () => {
    jest.useFakeTimers();
    listVisibleAlbums.mockImplementation(() => new Promise(() => undefined));
    fetchFeedPhotosFromTable.mockResolvedValue([
      {
        id: "album-search-1",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        uploaderIsPrivate: false,
        username: "student-a",
      },
    ]);

    const readPromise = albumReads.getSearchFeed(12);
    await jest.advanceTimersByTimeAsync(701);

    await expect(readPromise).resolves.toEqual([
      expect.objectContaining({
        id: "album-search-1",
      }),
    ]);
    expect(fetchFeedPhotosFromTable).toHaveBeenCalledWith("search", { limit: 48 });
    jest.useRealTimers();
  });
});
