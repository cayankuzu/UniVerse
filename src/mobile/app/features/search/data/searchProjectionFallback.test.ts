import {
  buildAlbumSearchFallbackEnvelope,
  buildSearchFallbackEnvelope,
  trySearchProjectionEnvelope,
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

jest.mock("../../../data/projections/projections.api.helpers", () => {
  return {
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
  };
});

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
    loadViewerBlockedVisibility: jest.fn(),
  };
});

jest.mock("./remote/search", () => ({
  SearchAPI: {
    search: jest.fn(),
  },
}));

const { AlbumAPI } = jest.requireMock("../../../data/content") as {
  AlbumAPI: { getFeed: jest.Mock; getSearchFeed: jest.Mock };
};
const { SearchAPI } = jest.requireMock("./remote/search") as {
  SearchAPI: { search: jest.Mock };
};
const { tryProjectionRpc } = jest.requireMock(
  "../../../data/projections/projections.api.helpers",
) as {
  tryProjectionRpc: jest.Mock;
};
const { getViewerRelationshipSnapshot } = jest.requireMock(
  "../../../data/social/relationshipSnapshot",
) as {
  getViewerRelationshipSnapshot: jest.Mock;
};
const { loadViewerBlockedVisibility } = jest.requireMock(
  "../../../data/social/blockedVisibility",
) as {
  loadViewerBlockedVisibilityOrEmpty: jest.Mock;
  loadViewerBlockedVisibility: jest.Mock;
};
const { loadViewerBlockedVisibilityOrEmpty } = jest.requireMock(
  "../../../data/social/blockedVisibility",
) as {
  loadViewerBlockedVisibilityOrEmpty: jest.Mock;
};

describe("search fallback visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tryProjectionRpc.mockResolvedValue(null);
    getViewerRelationshipSnapshot.mockResolvedValue({
      clubPrivacyMap: {},
      followingClubUsernames: [],
      followingStudentUsernames: [],
      followingUsernames: [],
    });
    loadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-id",
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(),
      blockedUsernames: new Set(),
      viewerId: "viewer-id",
    });
  });

  it("keeps unfollowed club events visible in event search fallback", async () => {
    SearchAPI.search.mockResolvedValue([
      {
        clubIsPrivate: true,
        clubUsername: "gizli-kulüp",
        id: "event-private",
        title: "Gizli etkinlik",
      },
      {
        clubIsPrivate: false,
        clubUsername: "açık-kulüp",
        id: "event-public",
        title: "Açık etkinlik",
      },
    ]);

    const envelope = await buildSearchFallbackEnvelope(
      {
        kind: "events",
        limit: 20,
        queryText: "",
      },
      "",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["event-private", "event-public"]);
  });

  it("keeps joined public events visible when the club is still unfollowed", async () => {
    SearchAPI.search.mockResolvedValue([
      {
        clubIsPrivate: false,
        clubUsername: "açık-kulüp",
        id: "event-joined-public",
        joined: true,
        title: "Açık etkinlik",
      },
    ]);

    const envelope = await buildSearchFallbackEnvelope(
      {
        kind: "events",
        limit: 20,
        queryText: "",
      },
      "",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["event-joined-public"]);
  });

  it("hides private students from album search fallback but keeps club albums visible", async () => {
    AlbumAPI.getSearchFeed.mockResolvedValue([
      {
        clubIsPrivate: true,
        id: "album-private-club",
        uploaderIsPrivate: false,
      },
      {
        clubIsPrivate: false,
        id: "album-private-student",
        uploaderIsPrivate: true,
      },
      {
        caption: "Açık albüm",
        clubIsPrivate: false,
        id: "album-public",
        title: "Açık albüm",
        uploaderIsPrivate: false,
        username: "açık-Öğrenci",
      },
    ]);

    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "",
      },
      "",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-public"]);
  });

  it("keeps public unfollowed uploader albums visible even on the club surface", async () => {
    AlbumAPI.getSearchFeed.mockResolvedValue([
      {
        caption: "Kulüp yüzeyinde açık albüm",
        clubIsPrivate: false,
        clubUsername: "takip-edilen-kulüp",
        id: "album-club-surface-public",
        showOnClubProfile: true,
        title: "Açık albüm",
        uploaderIsPrivate: false,
        username: "açık-Öğrenci",
      },
    ]);

    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
      },
      "",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-club-surface-public"]);
  });

  it("drops blocked club albums from album search fallback", async () => {
    loadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(["club-blocked"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-id",
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(["club-blocked"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-id",
    });
    AlbumAPI.getSearchFeed.mockResolvedValue([
      {
        caption: "Blocked club album",
        clubIsPrivate: false,
        clubUserId: "club-blocked",
        clubUsername: "blocked-club",
        id: "album-blocked",
        title: "Blocked album",
        uploaderIsPrivate: false,
        username: "student-a",
      },
      {
        caption: "Visible club album",
        clubIsPrivate: false,
        clubUserId: "club-visible",
        clubUsername: "visible-club",
        id: "album-visible",
        title: "Visible album",
        uploaderIsPrivate: false,
        username: "student-b",
      },
    ]);

    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
      },
      "",
      {
        allowLegacySearchApi: true,
      },
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-visible"]);
  });

  it("prefers bounded SQL search rows before legacy event feed fallback", async () => {
    tryProjectionRpc.mockResolvedValue({
      deletedIds: [],
      deltaToken: "2026-03-18T00:00:00.000Z",
      items: [
        {
          attendees: 0,
          club: "Sql Club",
          clubUsername: "sql-club",
          date: "2026-03-18",
          id: "event-sql",
          joined: false,
          liked: false,
          likes: 0,
          location: "Campus",
          title: "SQL event",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const envelope = await buildSearchFallbackEnvelope(
      {
        kind: "events",
        limit: 20,
        queryText: "sql",
        viewerId: "viewer-id",
      },
      "sql",
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["event-sql"]);
    expect(SearchAPI.search).not.toHaveBeenCalled();
  });

  it("prefers bounded SQL search rows before legacy album feed fallback", async () => {
    tryProjectionRpc.mockResolvedValue({
      deletedIds: [],
      deltaToken: "2026-03-18T00:00:00.000Z",
      items: [
        {
          comments: 0,
          createdAt: "2026-03-18T00:00:00.000Z",
          eventId: "event-1",
          eventTitle: "SQL event",
          id: "album-sql",
          image: "image.jpg",
          liked: false,
          likes: 0,
          name: "Uploader",
          username: "uploader",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const envelope = await buildAlbumSearchFallbackEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "sql",
        viewerId: "viewer-id",
      },
      "sql",
    );

    expect(envelope.items.map((item) => item.id)).toEqual(["album-sql"]);
    expect(AlbumAPI.getSearchFeed).not.toHaveBeenCalled();
  });

  it("hides the viewer and followed users from student fallback results", async () => {
    getViewerRelationshipSnapshot.mockResolvedValue({
      clubPrivacyMap: {},
      followingClubUsernames: [],
      followingStudentUsernames: ["followed-user"],
      followingUsernames: ["followed-user"],
    });
    loadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(["user-blocked"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-id",
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(["user-blocked"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-id",
    });
    SearchAPI.search.mockResolvedValue([
      {
        id: "viewer-id",
        username: "viewer",
      },
      {
        id: "user-followed",
        username: "followed-user",
      },
      {
        id: "user-visible",
        username: "visible-user",
      },
      {
        id: "user-blocked",
        username: "blocked-user",
      },
    ]);

    const envelope = await buildSearchFallbackEnvelope(
      {
        kind: "students",
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

    expect(envelope.items.map((item) => item.id)).toEqual(["user-visible"]);
  });

  it("filters blocked user rows out of projection search results", async () => {
    loadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(["blocked-user-id"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-id",
    });
    loadViewerBlockedVisibilityOrEmpty.mockResolvedValue({
      blockedIds: new Set(["blocked-user-id"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-id",
    });
    tryProjectionRpc.mockResolvedValue({
      deletedIds: [],
      deltaToken: "2026-03-18T00:00:00.000Z",
      items: [
        {
          id: "blocked-user-id",
          name: "Blocked User",
          username: "blocked-user",
        },
        {
          id: "visible-user-id",
          name: "Visible User",
          username: "visible-user",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    const envelope = await trySearchProjectionEnvelope(
      {
        kind: "students",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
      },
      "",
    );

    expect(envelope?.items.map((item) => item.id)).toEqual(["visible-user-id"]);
  });
});
