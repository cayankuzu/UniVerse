jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock("../../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));

jest.mock("../../profile/remoteProfileContent", () => ({
  fetchRemoteProfileEvents: jest.fn(),
}));

jest.mock("./events.feed", () => ({
  fetchEventsFromTable: jest.fn(),
  fetchProfileEventsFromTable: jest.fn(),
}));

jest.mock("./events.home", () => ({
  buildHomeFeedFallback: jest.fn(),
}));

jest.mock("./events.local", () => ({
  getLocalEventShadowByClubUserId: jest.fn(),
  getLocalEventShadowByClubUsername: jest.fn(),
}));

jest.mock("./events.models", () => ({
  fetchEventsFromRpc: jest.fn(),
}));

jest.mock("./events.shared", () => ({
  finalizeEventRows: jest.fn(async (rows: unknown[]) => rows),
  mergeUniqueEvents: jest.fn((...collections: unknown[][]) => collections.flat()),
}));

import { getEventsByClub, getProfileEvents, resetEventReadCachesForTests } from "./events.reads";

const { supabase } = jest.requireMock("../../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
    };
    from: jest.Mock;
  };
};

const { resolveProfileIdByUsername } = jest.requireMock("../../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

const { fetchRemoteProfileEvents } = jest.requireMock("../../profile/remoteProfileContent") as {
  fetchRemoteProfileEvents: jest.Mock;
};

const { fetchEventsFromRpc } = jest.requireMock("./events.models") as {
  fetchEventsFromRpc: jest.Mock;
};

function createProfilesTableBuilder(accountType: "club" | "student" = "student") {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: { account_type: accountType },
    error: null,
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  return { eq, maybeSingle, select };
}

describe("events.reads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetEventReadCachesForTests();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    fetchRemoteProfileEvents.mockResolvedValue([]);
    fetchEventsFromRpc.mockResolvedValue([]);
  });

  it("dedupes concurrent profile event reads for the same viewer and username", async () => {
    resolveProfileIdByUsername.mockResolvedValue("student-id");
    const profilesBuilder = createProfilesTableBuilder("student");
    const attendeeEq = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const attendeeSelect = jest.fn(() => ({ eq: attendeeEq }));
    supabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: profilesBuilder.select };
      }
      if (table === "event_attendees") {
        return { select: attendeeSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    let resolveRpc: ((value: unknown[]) => void) | undefined;
    fetchEventsFromRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );

    const firstRead = getProfileEvents("student-a");
    const secondRead = getProfileEvents("student-a");

    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!resolveRpc) {
      throw new Error("profile event rpc did not start");
    }

    resolveRpc([
      {
        id: "event-1",
        title: "Profile event",
      },
    ]);

    await expect(Promise.all([firstRead, secondRead])).resolves.toEqual([
      [
        expect.objectContaining({
          id: "event-1",
        }),
      ],
      [
        expect.objectContaining({
          id: "event-1",
        }),
      ],
    ]);

    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(resolveProfileIdByUsername).toHaveBeenCalledTimes(1);
    expect(fetchEventsFromRpc).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent club event reads for the same viewer and username", async () => {
    resolveProfileIdByUsername.mockResolvedValue("club-id");
    fetchEventsFromRpc.mockImplementation(async () => [
      {
        clubUsername: "club-a",
        id: "event-1",
        title: "Club event",
      },
    ]);

    await expect(
      Promise.all([getEventsByClub("club-a"), getEventsByClub("club-a")]),
    ).resolves.toEqual([
      [
        expect.objectContaining({
          id: "event-1",
        }),
      ],
      [
        expect.objectContaining({
          id: "event-1",
        }),
      ],
    ]);

    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(resolveProfileIdByUsername).toHaveBeenCalledTimes(1);
    expect(fetchEventsFromRpc).toHaveBeenCalledTimes(1);
  });
});
