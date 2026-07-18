jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import {
  ensureEventCommentCounts,
  fetchEventsFromTable,
  fetchProfileEventsFromTable,
  resolveViewerUsername,
} from "./events.feed";

const { supabase } = jest.requireMock("../../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
    };
    from: jest.Mock;
  };
};

type TableResponse = {
  data: unknown;
  error: unknown;
};

type QueryMethod = jest.Mock<QueryBuilder, unknown[]>;

type QueryBuilder = {
  eq: QueryMethod;
  in: QueryMethod;
  is: QueryMethod;
  order: QueryMethod;
  select: QueryMethod;
  then: Promise<TableResponse>["then"];
};

function createQueryBuilder(response: TableResponse): QueryBuilder {
  const responsePromise = Promise.resolve(response);
  const builder = {} as QueryBuilder;
  builder.eq = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.is = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.then = responsePromise.then.bind(responsePromise);
  return builder;
}

function mockTables(responses: Record<string, TableResponse>) {
  supabase.from.mockImplementation((table: string) => {
    const response = responses[table];
    if (!response) {
      throw new Error(`Unexpected table ${table}`);
    }
    return createQueryBuilder(response);
  });
}

const eventRow = {
  access_label: "public",
  address: "Campus hall",
  capacity: 80,
  categories: ["tech"],
  category: "Technology",
  club_id: "club-a",
  cover_image_path: "events/event-a.jpg",
  created_at: "2026-03-19T08:00:00.000Z",
  description: "Launch talk",
  ends_at: "2026-03-19T11:00:00.000Z",
  event_type: "talk",
  fee_label: "free",
  id: "event-a",
  level: "all",
  location_name: "Auditorium",
  materials: "laptop",
  starts_at: "2026-03-19T10:00:00.000Z",
  target_audience: "students",
  title: "Product Launch",
  visibility: "public",
};

describe("events.feed table fallbacks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: "viewer@example.com",
          id: "viewer-id",
          user_metadata: { username: "viewer-meta" },
        },
      },
    });
  });

  it("resolves viewer username from profile, metadata, then email", () => {
    expect(
      resolveViewerUsername(
        { id: "viewer-id", user_metadata: { username: "MetaName" } },
        new Map([["viewer-id", { username: "ProfileName" }]]),
      ),
    ).toBe("profilename");

    expect(
      resolveViewerUsername(
        { id: "viewer-id", user_metadata: { user_name: "FallbackMeta" } },
        new Map(),
      ),
    ).toBe("fallbackmeta");

    expect(resolveViewerUsername({ email: "student@uni.edu", id: "viewer-id" }, new Map())).toBe(
      "student",
    );
  });

  it("maps visible table events with viewer metrics and following filters", async () => {
    mockTables({
      event_attendees: {
        data: [{ event_id: "event-a" }],
        error: null,
      },
      event_likes: {
        data: [{ event_id: "event-a" }],
        error: null,
      },
      event_metrics: {
        data: [{ attendees_count: 2, comments_count: 5, event_id: "event-a", likes_count: 3 }],
        error: null,
      },
      events: {
        data: [
          eventRow,
          {
            ...eventRow,
            club_id: "club-b",
            id: "event-b",
            title: "Filtered Event",
          },
        ],
        error: null,
      },
      follows: {
        data: [{ following_id: "club-a" }],
        error: null,
      },
      profiles: {
        data: [
          {
            club_name: "Club A",
            is_private: false,
            name: "",
            profile_image_path: "profiles/club-a.jpg",
            university: "Uni",
            user_id: "club-a",
            username: "club-a",
          },
          {
            club_name: "Club B",
            is_private: false,
            name: "",
            profile_image_path: "",
            university: "Uni",
            user_id: "club-b",
            username: "club-b",
          },
        ],
        error: null,
      },
    });

    await expect(fetchEventsFromTable("following")).resolves.toEqual([
      expect.objectContaining({
        attendees: 2,
        club: "Club A",
        clubImage: "profiles/club-a.jpg",
        clubUserId: "club-a",
        comments: 5,
        date: "2026-03-19",
        id: "event-a",
        joined: true,
        liked: true,
        likes: 3,
        startTime: "10:00",
        title: "Product Launch",
      }),
    ]);
  });

  it("maps profile event table fallbacks for attendee-driven recovery", async () => {
    mockTables({
      event_attendees: {
        data: [{ event_id: "event-a" }],
        error: null,
      },
      event_likes: {
        data: [],
        error: null,
      },
      event_metrics: {
        data: [{ attendees_count: 0, comments_count: 1, event_id: "event-a", likes_count: 0 }],
        error: null,
      },
      events: {
        data: [eventRow],
        error: null,
      },
      profiles: {
        data: [
          {
            club_name: "",
            is_private: false,
            name: "Club Display",
            profile_image_path: "",
            university: "Uni",
            user_id: "club-a",
            username: "club-a",
          },
        ],
        error: null,
      },
    });

    await expect(fetchProfileEventsFromTable(["event-a", "event-a", ""])).resolves.toEqual([
      expect.objectContaining({
        club: "Club Display",
        comments: 1,
        id: "event-a",
        joined: true,
        liked: false,
      }),
    ]);
  });

  it("hydrates missing comment counts without replacing existing counts", async () => {
    mockTables({
      event_metrics: {
        data: [{ comments_count: 7, event_id: "event-a" }],
        error: null,
      },
    });

    const unchanged = [{ ...eventRow, comments: 2 }] as never;
    await expect(ensureEventCommentCounts([])).resolves.toEqual([]);
    await expect(ensureEventCommentCounts(unchanged)).resolves.toBe(unchanged);
    await expect(
      ensureEventCommentCounts([{ ...eventRow, comments: undefined }] as never),
    ).resolves.toEqual([expect.objectContaining({ comments: 7, id: "event-a" })]);
  });
});
