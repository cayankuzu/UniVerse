import {
  AlbumAPI,
  fetchEventsFromRpc,
  setupHomeProjectionApiTestMocks,
  supabase,
  tryProjectionRpc,
} from "./homeProjectionApi.test.helpers";
import { getHomeFeed } from "./homeProjectionApi";

describe("getHomeFeed attendee reconciliation", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("reconciles joined attendee state from event_attendees during the home fallback", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (fetchEventsFromRpc as jest.Mock).mockResolvedValue([
      {
        attendees: 0,
        clubUsername: "followed-club",
        createdAt: "2026-03-18T08:00:00.000Z",
        feedActorType: "club",
        feedActorUsername: "followed-club",
        feedSource: "following_club",
        id: "event-joined",
        joined: false,
        title: "Joined event",
      },
    ]);
    (AlbumAPI.getVisibleByEventIds as jest.Mock).mockResolvedValue([]);
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const response =
        table === "event_attendees"
          ? { data: [{ event_id: "event-joined" }], error: null }
          : table === "event_metrics"
            ? { data: [{ attendees_count: 0, event_id: "event-joined" }], error: null }
            : { data: [], error: null };
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
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn(),
        select: jest.fn(),
        then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.in.mockReturnValue(builder);
      builder.is.mockReturnValue(builder);
      builder.order.mockReturnValue(builder);
      return builder;
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

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("event");
    expect(result.items[0].kind === "event" ? result.items[0].event.joined : false).toBe(true);
    expect(result.items[0].kind === "event" ? result.items[0].event.attendees : 0).toBe(1);
  });
});
