import {
  buildAlbumSearchFallbackEnvelope,
  buildSearchFallbackEnvelope,
} from "./searchProjectionFallback";

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock("../../../data/projections/projections.api.helpers", () => ({
  mapEnvelopeItems: (
    envelope: { items?: unknown[]; [key: string]: unknown },
    mapper: (item: unknown) => unknown,
  ) => ({
    ...envelope,
    items: Array.isArray(envelope.items) ? envelope.items.map((item) => mapper(item)) : [],
  }),
  toSearchProjectionItem: (item: unknown) => item,
  tryProjectionRpc: jest.fn(),
}));

jest.mock("../../../data/content", () => ({
  AlbumAPI: {
    getSearchFeed: jest.fn(),
  },
}));

jest.mock("../../../data/social/relationshipSnapshot", () => ({
  getViewerRelationshipSnapshot: jest.fn(),
}));

jest.mock("../../../data/social/blockedVisibility", () => ({
  filterBlockedAlbums: (items: unknown[]) => items,
  filterBlockedEvents: (items: unknown[]) => items,
  filterBlockedSearchUsers: (items: unknown[]) => items,
  loadViewerBlockedVisibilityOrEmpty: jest.fn(),
}));

jest.mock("./remote/search", () => ({
  SearchAPI: {
    search: jest.fn(),
  },
}));

const { AlbumAPI } = jest.requireMock("../../../data/content") as {
  AlbumAPI: { getSearchFeed: jest.Mock };
};
const { SearchAPI } = jest.requireMock("./remote/search") as {
  SearchAPI: { search: jest.Mock };
};
const { getViewerRelationshipSnapshot } = jest.requireMock(
  "../../../data/social/relationshipSnapshot",
) as {
  getViewerRelationshipSnapshot: jest.Mock;
};
const { loadViewerBlockedVisibilityOrEmpty } = jest.requireMock(
  "../../../data/social/blockedVisibility",
) as {
  loadViewerBlockedVisibilityOrEmpty: jest.Mock;
};

describe("search fallback stability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getViewerRelationshipSnapshot.mockResolvedValue({
      clubPrivacyMap: {},
      followingClubUsernames: [],
      followingStudentUsernames: [],
      followingUsernames: [],
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-id",
    });
  });

  it("keeps album discovery fallback active even when legacy edge reads are disabled", async () => {
    AlbumAPI.getSearchFeed.mockResolvedValue([
      {
        caption: "Visible album",
        clubIsPrivate: false,
        clubUsername: "visible-club",
        id: "album-visible",
        title: "Visible album",
        uploaderIsPrivate: false,
        username: "visible-student",
      },
    ]);

    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
        viewerUsername: "viewer",
      },
      "",
      {
        allowLegacySearchApi: false,
        skipSqlSource: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-visible"]);
    expect(AlbumAPI.getSearchFeed).toHaveBeenCalledTimes(1);
  });

  it("keeps event discovery fallback active even when legacy edge reads are disabled", async () => {
    SearchAPI.search.mockResolvedValue([
      {
        clubIsPrivate: false,
        clubUsername: "visible-club",
        id: "event-visible",
        title: "Visible event",
      },
    ]);

    const envelope = await buildSearchFallbackEnvelope(
      {
        kind: "events",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
        viewerUsername: "viewer",
      },
      "",
      {
        allowLegacySearchApi: false,
        skipSqlSource: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["event-visible"]);
    expect(SearchAPI.search).toHaveBeenCalledWith("", "events", undefined, undefined, 20);
  });
});
