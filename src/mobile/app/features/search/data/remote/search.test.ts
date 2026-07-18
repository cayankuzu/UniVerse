import { TextDecoder, TextEncoder } from "util";

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

let mockDisableLegacyEdgeReads = true;
let mockTableSearchResult:
  | {
      data: unknown[] | null;
      error: { message: string } | null;
    }
  | undefined;

function mockBuildProfilesQuery() {
  return {
    contains: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn(async () => mockTableSearchResult || { data: [], error: null }),
    or: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  };
}

jest.mock("../../../../platform/config/runtime", () => ({
  get RUNTIME_FLAGS() {
    return {
      disableLegacyEdgeReads: mockDisableLegacyEdgeReads,
      useOptimisticCreateEvent: true,
      useOptimisticProfileUpdate: true,
      useProjectionAlbum: true,
      useProjectionEventDetail: true,
      useProjectionSearch: true,
    };
  },
}));

jest.mock("../../../../platform/api/core", () => ({
  get: jest.fn(),
  isFunctionUnavailable: jest.fn(),
}));

jest.mock("../../../../data/social/blockedVisibility", () => ({
  createEmptyBlockedVisibilitySnapshot: jest.fn(() => ({
    blockedIds: new Set(),
    blockedUsernames: new Set(),
    viewerId: "",
  })),
  filterBlockedAlbums: (items: unknown[]) => items,
  filterBlockedEvents: (items: unknown[]) => items,
  filterBlockedSearchUsers: (items: unknown[]) => items,
  loadViewerBlockedVisibilityOrEmpty: jest.fn(async () => ({
    blockedIds: new Set(),
    blockedUsernames: new Set(),
    viewerId: "",
  })),
}));

jest.mock("../../../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockBuildProfilesQuery()),
  },
}));

jest.mock("../../../../data/content", () => ({
  AlbumAPI: {
    getFeed: jest.fn(),
    getSearchFeed: jest.fn(),
  },
  EventAPI: {
    getFeed: jest.fn(),
  },
}));

const { SearchAPI } = require("./search") as typeof import("./search");
const { AlbumAPI } = jest.requireMock("../../../../data/content") as {
  AlbumAPI: { getFeed: jest.Mock; getSearchFeed: jest.Mock };
};

describe("SearchAPI.search", () => {
  beforeEach(() => {
    mockDisableLegacyEdgeReads = true;
    mockTableSearchResult = { data: [], error: null };
  });

  it("returns an empty result when the table query is empty", async () => {
    const results = await SearchAPI.search("missing", "students");

    expect(results).toEqual([]);
  });

  it("preserves the original table error", async () => {
    mockTableSearchResult = { data: null, error: { message: "profiles lookup failed" } };

    await expect(SearchAPI.search("broken", "clubs")).rejects.toThrow("profiles lookup failed");
  });

  it("uses the search album surface instead of the feed surface", async () => {
    AlbumAPI.getSearchFeed.mockResolvedValue([]);

    await SearchAPI.search("album", "albums");

    expect(AlbumAPI.getSearchFeed).toHaveBeenCalledTimes(1);
    expect(AlbumAPI.getFeed).not.toHaveBeenCalled();
  });
});
