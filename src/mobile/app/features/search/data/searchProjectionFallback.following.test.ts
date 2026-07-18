import { buildAlbumSearchFallbackEnvelope } from "./searchProjectionFallback";

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
  nowEnvelope: (items: unknown[]) => ({
    deletedIds: [],
    deltaToken: "2026-03-26T00:00:00.000Z",
    items,
    nextCursor: null,
    serverTime: "2026-03-26T00:00:00.000Z",
    updatedItems: [],
  }),
  toSearchProjectionItem: (item: unknown) => item,
  tryProjectionRpc: jest.fn(),
}));

jest.mock("../../../data/content", () => ({
  AlbumAPI: {
    getFeed: jest.fn(),
    getSearchFeed: jest.fn(),
  },
}));

jest.mock("../../../data/social/relationshipSnapshot", () => ({
  getViewerRelationshipSnapshot: jest.fn(),
}));

jest.mock("../../../data/social/blockedVisibility", () => {
  const actual = jest.requireActual("../../../data/social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibilityOrEmpty: jest.fn(),
  };
});

const { AlbumAPI } = jest.requireMock("../../../data/content") as {
  AlbumAPI: { getFeed: jest.Mock; getSearchFeed: jest.Mock };
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
const { tryProjectionRpc } = jest.requireMock(
  "../../../data/projections/projections.api.helpers",
) as {
  tryProjectionRpc: jest.Mock;
};

describe("search fallback follow visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tryProjectionRpc.mockResolvedValue(null);
    getViewerRelationshipSnapshot.mockResolvedValue({
      clubPrivacyMap: {},
      followingClubUsernames: ["followed-club"],
      followingStudentUsernames: [],
      followingUsernames: ["followed-club"],
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-id",
    });
    AlbumAPI.getSearchFeed.mockResolvedValue([
      {
        caption: "Followed club album",
        clubIsPrivate: false,
        clubUsername: "followed-club",
        id: "album-followed-club",
        showOnClubProfile: true,
        title: "Followed club album",
        uploaderIsPrivate: false,
        username: "open-student",
      },
    ]);
  });

  it("hides followed club albums from blank discovery fallback", async () => {
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
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual([]);
  });

  it("keeps followed club albums visible during explicit album search fallback", async () => {
    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "followed",
        viewerId: "viewer-id",
        viewerUsername: "viewer",
      },
      "followed",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-followed-club"]);
  });
});
