import { EventAPI } from "./events.api";
import { resetEventReadCachesForTests } from "./events/events.reads";
import { mockProfileAccountType } from "./events.api.test.helpers";

jest.mock("../../platform/config/runtime", () => ({
  RUNTIME_FLAGS: {
    disableLegacyEdgeReads: true,
  },
}));

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

jest.mock("../normalizers/mutationTelemetry", () => ({
  observeMutation: jest.fn(async ({ task }: { task: () => Promise<unknown> }) => task()),
}));

jest.mock("../../platform/api/core", () => ({
  del: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock("../notifications/pushDispatchWakeup", () => ({
  triggerPushDispatchWakeup: jest.fn(),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      refreshSession: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("./events/events.attendance", () => ({
  readEventAttendanceState: jest.fn(),
  reconcileEventAttendanceDirect: jest.fn(),
}));
jest.mock("./events/events.likes", () => ({
  readEventLikeState: jest.fn(),
  reconcileEventLikeDirect: jest.fn(),
}));
jest.mock("../social/blockedInteractionGuard", () => ({
  assertEventInteractionAllowed: jest.fn(async () => "viewer-id"),
}));
jest.mock("./events/events.albumCounts", () => ({
  hydrateEventsWithServerAlbumCounts: jest.fn(async (rows: unknown) => rows),
}));

jest.mock("./events/events.errors", () => ({
  normalizeEventCreateErrorMessage: jest.fn((error: unknown) =>
    String((error as { message?: string })?.message || error || ""),
  ),
}));
jest.mock("../policies/eventAccess", () => ({
  resolveVisibilityFromAccess: jest.fn(() => "public"),
}));
jest.mock("./events/events.home", () => ({
  buildHomeFeedFallback: jest.fn(async () => []),
}));
jest.mock("./events/events.feed", () => ({
  ensureEventCommentCounts: jest.fn(async (rows: unknown) => rows),
  fetchEventsFromTable: jest.fn(async () => []),
  fetchProfileEventsFromTable: jest.fn(async () => []),
}));

jest.mock("./events/events.comments", () => ({
  addEventComment: jest.fn(),
  getEventCommentLikes: jest.fn(),
  getEventComments: jest.fn(),
  toggleEventCommentLike: jest.fn(),
}));
jest.mock("./events/events.local", () => ({
  getLocalEventShadowByClubUserId: jest.fn(async () => []),
  getLocalEventShadowByClubUsername: jest.fn(async () => []),
  persistLocalEventShadow: jest.fn(),
}));
jest.mock("../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));
jest.mock("../../shared/utils/dateTime", () => ({
  toIsoDateTime: jest.fn(),
}));

jest.mock("./events/events.models", () => ({
  buildHiddenLikeUser: jest.fn(),
  fetchEventAttendeesFromApi: jest.fn(async () => []),
  fetchEventsFromRpc: jest.fn(async () => []),
  fetchEventLikesFromApi: jest.fn(async () => []),
  mapFollowUser: jest.fn((value: unknown) => value),
}));

const { post } = jest.requireMock("../../platform/api/core") as {
  post: jest.Mock;
};

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
      refreshSession: jest.Mock;
    };
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { readEventAttendanceState, reconcileEventAttendanceDirect } = jest.requireMock(
  "./events/events.attendance",
) as {
  readEventAttendanceState: jest.Mock;
  reconcileEventAttendanceDirect: jest.Mock;
};

const { readEventLikeState, reconcileEventLikeDirect } = jest.requireMock(
  "./events/events.likes",
) as {
  readEventLikeState: jest.Mock;
  reconcileEventLikeDirect: jest.Mock;
};

const { buildHomeFeedFallback } = jest.requireMock("./events/events.home") as {
  buildHomeFeedFallback: jest.Mock;
};

const { fetchEventsFromRpc } = jest.requireMock("./events/events.models") as {
  fetchEventsFromRpc: jest.Mock;
};

const { fetchEventsFromTable, fetchProfileEventsFromTable } = jest.requireMock(
  "./events/events.feed",
) as {
  fetchEventsFromTable: jest.Mock;
  fetchProfileEventsFromTable: jest.Mock;
};

const { getLocalEventShadowByClubUsername } = jest.requireMock("./events/events.local") as {
  getLocalEventShadowByClubUsername: jest.Mock;
};

const { resolveProfileIdByUsername } = jest.requireMock("../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

describe("EventAPI mutation fallbacks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetEventReadCachesForTests();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });
    readEventAttendanceState.mockResolvedValue(null);
    reconcileEventAttendanceDirect.mockResolvedValue(null);
    readEventLikeState.mockResolvedValue(null);
    reconcileEventLikeDirect.mockResolvedValue(null);
    resolveProfileIdByUsername.mockResolvedValue("profile-id");
    fetchEventsFromTable.mockResolvedValue([]);
    fetchProfileEventsFromTable.mockResolvedValue([]);
    getLocalEventShadowByClubUsername.mockResolvedValue([]);
    buildHomeFeedFallback.mockImplementation(async () => []);
    mockProfileAccountType(supabase, "student");
  });

  it("falls back to the base attendance rpc when the patch wrapper is unavailable", async () => {
    supabase.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      if (args.client_mutation_id) {
        return { data: null, error: { message: "function-not-found" } };
      }
      return { data: [{ joined: true, attendees_count: 4 }], error: null };
    });

    await expect(
      EventAPI.attend("event-1", {
        clientMutationId: "event-attend:1",
        desiredJoined: true,
      }),
    ).resolves.toEqual({ joined: true, count: 4 });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "toggle_event_attendance", {
      client_mutation_id: "event-attend:1",
      target_event_id: "event-1",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "toggle_event_attendance", {
      target_event_id: "event-1",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("refreshes the session and retries the patch attendance rpc before any fallback", async () => {
    let callCount = 0;
    supabase.rpc.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return { data: null, error: { message: "Invalid JWT" } };
      }
      return { data: [{ joined: true, attendees_count: 6 }], error: null };
    });

    await expect(
      EventAPI.attend("event-2", {
        clientMutationId: "event-attend:2",
        desiredJoined: true,
      }),
    ).resolves.toEqual({ joined: true, count: 6 });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(post).not.toHaveBeenCalled();
  });

  it("reconciles attendance directly instead of calling the compat endpoint when both rpc variants fail", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "function-not-found" },
    });
    readEventAttendanceState.mockResolvedValue({
      count: 1,
      joined: false,
    });
    reconcileEventAttendanceDirect.mockResolvedValue({
      count: 2,
      joined: true,
    });

    await expect(
      EventAPI.attend("event-3", {
        clientMutationId: "event-attend:3",
        desiredJoined: true,
      }),
    ).resolves.toEqual({ joined: true, count: 2 });

    expect(reconcileEventAttendanceDirect).toHaveBeenCalledWith("event-3", "viewer-id", true);
    expect(post).not.toHaveBeenCalled();
  });

  it("falls back to the base like rpc without using the compat endpoint", async () => {
    supabase.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      if (args.client_mutation_id) {
        return { data: null, error: { message: "function-not-found" } };
      }
      return { data: [{ liked: true, likes_count: 8 }], error: null };
    });

    await expect(
      EventAPI.like("event-4", {
        clientMutationId: "event-like:1",
        desiredLiked: true,
      }),
    ).resolves.toEqual({ liked: true, count: 8 });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "toggle_event_like", {
      client_mutation_id: "event-like:1",
      target_event_id: "event-4",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "toggle_event_like", {
      target_event_id: "event-4",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("uses the viewer-aware home feed rpc for followed content resolution", async () => {
    fetchEventsFromRpc.mockResolvedValue([]);

    await expect(EventAPI.getHomeFeed()).resolves.toEqual([]);

    expect(fetchEventsFromRpc).toHaveBeenCalledWith("list_home_feed_events_for_viewer", {
      target_viewer_id: "viewer-id",
    });
  });

  it("uses the direct visible event table feed when recovering home reads after an rpc miss", async () => {
    fetchEventsFromRpc.mockResolvedValue([]);
    fetchEventsFromTable.mockResolvedValue([
      {
        club: "Club A",
        clubImage: "",
        clubUserId: "club-a-id",
        clubUsername: "club-a",
        createdAt: "2026-03-19T10:00:00.000Z",
        date: "2026-03-19",
        description: "",
        id: "event-table-fallback",
        title: "Table fallback event",
      },
    ]);
    buildHomeFeedFallback.mockImplementation(async (loadVisibleFeed: () => Promise<unknown[]>) =>
      loadVisibleFeed(),
    );

    await expect(EventAPI.getHomeFeed()).resolves.toEqual([
      expect.objectContaining({
        id: "event-table-fallback",
        title: "Table fallback event",
      }),
    ]);

    expect(fetchEventsFromTable).toHaveBeenCalledWith("all");
  });

  it("prefers profile-scoped rpc rows when recovering club profile events", async () => {
    mockProfileAccountType(supabase, "club");
    resolveProfileIdByUsername.mockResolvedValue("club-profile-id");
    fetchEventsFromRpc.mockImplementation(async (name: string) => {
      if (name === "list_profile_visible_events") {
        return [
          {
            access: "public",
            address: "",
            attendees: 0,
            capacity: 0,
            categories: [],
            category: "",
            club: "Club A",
            clubImage: "",
            clubIsPrivate: true,
            clubUserId: "club-profile-id",
            clubUsername: "club-a",
            comments: 0,
            createdAt: "2026-03-19T10:00:00.000Z",
            date: "2026-03-19",
            description: "",
            effectiveVisibility: "followers_only",
            endDate: "2026-03-19",
            endTime: "11:00",
            fee: "",
            id: "event-profile-scope",
            image: "",
            joined: false,
            level: "",
            liked: false,
            likes: 0,
            location: "",
            materials: "",
            startDate: "2026-03-19",
            startTime: "10:00",
            targetAudience: "",
            title: "Profile scoped event",
            type: "",
            university: "",
            visibility: "public",
          },
        ];
      }
      return [];
    });

    await expect(EventAPI.getProfileEvents("club-a")).resolves.toEqual([
      expect.objectContaining({
        id: "event-profile-scope",
        title: "Profile scoped event",
      }),
    ]);

    expect(fetchEventsFromRpc).toHaveBeenCalledWith("list_profile_visible_events", {
      target_profile_id: "club-profile-id",
    });
  });

  it("treats an empty student profile rpc as authoritative and skips attendee table fallback", async () => {
    mockProfileAccountType(supabase, "student");
    resolveProfileIdByUsername.mockResolvedValue("student-profile-id");
    fetchEventsFromRpc.mockResolvedValue([]);

    const attendeeEq = jest.fn().mockResolvedValue({
      data: [{ event_id: "event-leak" }],
      error: null,
    });
    const attendeeSelect = jest.fn(() => ({ eq: attendeeEq }));
    supabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { account_type: "student" },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "event_attendees") {
        return { select: attendeeSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    fetchProfileEventsFromTable.mockResolvedValue([
      {
        id: "event-leak",
        title: "Leaked attendee event",
      },
    ]);

    await expect(EventAPI.getProfileEvents("student-a")).resolves.toEqual([]);

    expect(fetchProfileEventsFromTable).not.toHaveBeenCalled();
  });

  it("treats an empty club profile rpc as authoritative and skips secondary fallbacks", async () => {
    mockProfileAccountType(supabase, "club");
    resolveProfileIdByUsername.mockResolvedValue("club-profile-id");
    getLocalEventShadowByClubUsername.mockResolvedValue([
      {
        club: "Club A",
        clubUserId: "club-profile-id",
        clubUsername: "club-a",
        createdAt: "2026-03-19T10:00:00.000Z",
        date: "2026-03-19",
        id: "event-shadow",
        title: "Shadow event",
      },
    ]);
    fetchEventsFromRpc.mockImplementation(async (name: string) => {
      if (name === "list_profile_visible_events") {
        return [];
      }
      if (name === "list_club_visible_events") {
        return [
          {
            club: "Club A",
            clubUserId: "club-profile-id",
            clubUsername: "club-a",
            createdAt: "2026-03-19T10:00:00.000Z",
            date: "2026-03-19",
            id: "event-leak",
            title: "Leaked club event",
          },
        ];
      }
      return [];
    });
    fetchEventsFromTable.mockResolvedValue([
      {
        club: "Club A",
        clubUserId: "club-profile-id",
        clubUsername: "club-a",
        createdAt: "2026-03-19T10:00:00.000Z",
        date: "2026-03-19",
        id: "event-table-leak",
        title: "Leaked table event",
      },
    ]);

    await expect(EventAPI.getProfileEvents("club-a")).resolves.toEqual([]);

    expect(fetchEventsFromRpc).toHaveBeenCalledTimes(1);
    expect(fetchEventsFromTable).not.toHaveBeenCalled();
  });

  it("keeps local club event shadow on the club's own profile", async () => {
    mockProfileAccountType(supabase, "club");
    resolveProfileIdByUsername.mockResolvedValue("viewer-id");
    getLocalEventShadowByClubUsername.mockResolvedValue([
      {
        club: "Club A",
        clubUserId: "viewer-id",
        clubUsername: "club-a",
        createdAt: "2026-03-19T10:00:00.000Z",
        date: "2026-03-19",
        id: "event-shadow",
        title: "Shadow event",
      },
    ]);
    fetchEventsFromRpc.mockResolvedValue([]);

    await expect(EventAPI.getProfileEvents("club-a")).resolves.toEqual([
      expect.objectContaining({
        id: "event-shadow",
        title: "Shadow event",
      }),
    ]);
  });
});
