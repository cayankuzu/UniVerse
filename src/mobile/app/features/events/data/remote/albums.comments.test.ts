let mockDisableLegacyEdgeReads = true;
let mockAlbumCommentTableResult:
  | {
      data: unknown[] | null;
      error: { message: string } | null;
    }
  | undefined;
let mockAlbumCommentApiResult: unknown[] = [];
let mockAlbumCommentApiError: Error | null = null;

jest.mock("../../../../platform/config/runtime", () => ({
  IS_DEVELOPMENT_RUNTIME: false,
  IS_TEST_RUNTIME: true,
  readBooleanEnv: jest.fn((_name: string, fallback: boolean) => fallback),
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

const mockGet = jest.fn(async (..._args: unknown[]) => {
  if (mockAlbumCommentApiError) {
    throw mockAlbumCommentApiError;
  }
  return mockAlbumCommentApiResult;
});

function mockBuildAlbumCommentQuery() {
  const order = jest.fn(async () => mockAlbumCommentTableResult || { data: [], error: null });
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  return { select };
}

jest.mock("../../../../platform/api/core", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: jest.fn(),
}));

jest.mock("../../../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: null } })),
    },
    from: jest.fn(() => mockBuildAlbumCommentQuery()),
  },
}));

jest.mock("../../../../data/profile/profileDisplay", () => ({
  toDisplayName: jest.fn(() => "Test User"),
}));

jest.mock("../../../../shared/utils/dateTime", () => ({
  timeAgo: jest.fn(() => "simdi"),
}));

jest.mock("../../../../data/content/events/events.models", () => ({
  buildHiddenLikeUser: jest.fn(),
  mapFollowUser: jest.fn(),
}));

const { getAlbumPhotoComments } =
  require("../../../../data/content/albums/albums.comments") as typeof import("../../../../data/content/albums/albums.comments");

describe("getAlbumPhotoComments", () => {
  beforeEach(() => {
    mockDisableLegacyEdgeReads = true;
    mockAlbumCommentTableResult = { data: null, error: { message: "album comments failed" } };
    mockAlbumCommentApiResult = [];
    mockAlbumCommentApiError = null;
    mockGet.mockClear();
  });

  it("returns an empty list without calling legacy edge comments", async () => {
    const results = await getAlbumPhotoComments("photo-1");

    expect(results).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
