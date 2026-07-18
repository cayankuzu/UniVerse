import { supabase } from "../../platform/supabase";
import {
  buildHomeProjectionItems,
  filterLegacyHomeItems,
  tryProjectionRpc,
} from "./projections.api.helpers";
import { resetProjectionRpcStateForTests } from "./projections.rpc";

jest.mock("../../platform/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

jest.mock("../../platform/api/core", () => ({
  isFunctionUnavailable: jest.fn(() => false),
}));

describe("tryProjectionRpc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    resetProjectionRpcStateForTests();
  });

  it("dedupes concurrent RPC calls with the same normalized params", async () => {
    type RpcResult = {
      data: {
        deleted_ids: string[];
        delta_token: string;
        items: [];
        next_cursor: null;
        server_time: string;
        updated_items: [];
      };
      error: null;
    };
    let resolveRpc: (value: RpcResult) => void = () => undefined;
    (supabase.rpc as jest.Mock).mockImplementation(
      () =>
        new Promise<RpcResult>((resolve) => {
          resolveRpc = resolve;
        }),
    );

    const first = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      limit_count: 20,
      viewer_id: "viewer-1",
    });
    const second = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      viewer_id: "viewer-1",
      limit_count: 20,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    resolveRpc({
      data: {
        deleted_ids: [],
        delta_token: "delta-1",
        items: [],
        next_cursor: null,
        server_time: "2026-03-12T00:00:00.000Z",
        updated_items: [],
      },
      error: null,
    });

    await expect(first).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:00.000Z",
      updatedItems: [],
    });
    await expect(second).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:00.000Z",
      updatedItems: [],
    });
  });

  it("counts a shared slow RPC timeout only once for circuit breaker purposes", async () => {
    jest.useFakeTimers();

    let callCount = 0;
    (supabase.rpc as jest.Mock).mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return {
          abortSignal: (signal: AbortSignal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
                { once: true },
              );
            }),
        };
      }
      return Promise.resolve({
        data: {
          deleted_ids: [],
          delta_token: "delta-2",
          items: [{ id: "event-1" }],
          next_cursor: null,
          server_time: "2026-03-12T00:00:10.000Z",
          updated_items: [],
        },
        error: null,
      });
    });

    const first = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      limit_count: 20,
      viewer_id: "viewer-1",
    });
    const second = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      limit_count: 20,
      viewer_id: "viewer-1",
    });
    const third = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      limit_count: 20,
      viewer_id: "viewer-1",
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_500);

    await expect(Promise.all([first, second, third])).resolves.toEqual([null, null, null]);

    await expect(
      tryProjectionRpc<{ id: string }>("home_feed_projection", {
        limit_count: 20,
        viewer_id: "viewer-2",
      }),
    ).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-2",
      items: [{ id: "event-1" }],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:10.000Z",
      updatedItems: [],
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("fails open search projection requests on the shorter search timeout", async () => {
    jest.useFakeTimers();
    (supabase.rpc as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const onSettled = jest.fn();
    void tryProjectionRpc<{ id: string }>("search_results_projection_v2", {
      kind_name: "students",
      limit_count: 20,
      viewer_id: "viewer-1",
    }).then(onSettled);

    await jest.advanceTimersByTimeAsync(2_500);

    expect(onSettled).toHaveBeenCalledWith(null);
  });

  it("drops overlapping hot first-page RPCs when the same surface is already in flight", async () => {
    type RpcResult = {
      data: {
        deleted_ids: string[];
        delta_token: string;
        items: [];
        next_cursor: null;
        server_time: string;
        updated_items: [];
      };
      error: null;
    };
    let resolveRpc: (value: RpcResult) => void = () => undefined;
    (supabase.rpc as jest.Mock).mockImplementation(
      () =>
        new Promise<RpcResult>((resolve) => {
          resolveRpc = resolve;
        }),
    );

    const first = tryProjectionRpc<{ id: string }>("home_feed_projection", {
      limit_count: 12,
      viewer_id: "viewer-1",
    });

    await expect(
      tryProjectionRpc<{ id: string }>("home_feed_projection", {
        limit_count: 12,
        viewer_id: "viewer-2",
      }),
    ).resolves.toBeNull();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    resolveRpc({
      data: {
        deleted_ids: [],
        delta_token: "delta-3",
        items: [],
        next_cursor: null,
        server_time: "2026-03-12T00:00:20.000Z",
        updated_items: [],
      },
      error: null,
    });

    await expect(first).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-3",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:20.000Z",
      updatedItems: [],
    });
  });

  it("opens the circuit breaker after repeated counted rpc failures", async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: {
        message: "Could not find the function public.home_feed_projection in the schema cache",
      },
    });

    await expect(
      tryProjectionRpc("home_feed_projection", {
        limit_count: 20,
        viewer_id: "viewer-1",
      }),
    ).resolves.toBeNull();
    await expect(
      tryProjectionRpc("home_feed_projection", {
        limit_count: 20,
        viewer_id: "viewer-2",
      }),
    ).resolves.toBeNull();
    await expect(
      tryProjectionRpc("home_feed_projection", {
        limit_count: 20,
        viewer_id: "viewer-3",
      }),
    ).resolves.toBeNull();

    await expect(
      tryProjectionRpc("home_feed_projection", {
        limit_count: 20,
        viewer_id: "viewer-4",
      }),
    ).resolves.toBeNull();

    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });
});

describe("buildHomeProjectionItems", () => {
  it("does not treat joined student events as own home content", () => {
    const items = buildHomeProjectionItems({
      albums: [],
      events: [
        {
          clubUsername: "takip-edilen-kulüp",
          createdAt: "2026-03-14T00:00:00.000Z",
          feedActorType: "student",
          feedActorUsername: "takip-edilen-Öğrenci",
          id: "event-1",
          joined: true,
        } as any,
      ],
      viewerUsername: "viewer",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "event:event-1",
      kind: "event",
      source: "following",
    });
  });

  it("does not count own-only albums toward event card album counts", () => {
    const items = buildHomeProjectionItems({
      albums: [
        {
          clubUsername: "club-1",
          createdAt: "2026-03-14T00:00:00.000Z",
          eventId: "event-1",
          id: "album-own-only",
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
          username: "viewer",
        },
        {
          clubUsername: "club-1",
          createdAt: "2026-03-15T00:00:00.000Z",
          eventId: "event-1",
          id: "album-club-visible",
          showOnClubProfile: true,
          showOnOwnProfile: true,
          showOnProfile: true,
          username: "viewer",
        },
      ] as any,
      events: [
        {
          albumCount: 0,
          clubUsername: "club-1",
          createdAt: "2026-03-13T00:00:00.000Z",
          feedActorType: "club",
          id: "event-1",
        } as any,
      ],
      viewerUsername: "viewer",
    });

    expect(items.find((item) => item.kind === "event")?.event.albumCount).toBe(1);
  });
});

describe("filterLegacyHomeItems", () => {
  it("keeps legacy fallback filtering scoped to local fallback safety rules", () => {
    const items = filterLegacyHomeItems(
      [
        {
          actor: "club",
          event: {
            clubUsername: "blocked-club",
            feedActorUsername: "blocked-club",
            id: "event-blocked",
            startDate: "2026-03-14",
            title: "Blocked event",
          },
          id: "event:event-blocked",
          kind: "event",
          sortDate: "2026-03-14T10:00:00.000Z",
          source: "following",
        },
        {
          actor: "student",
          album: {
            clubUsername: "club-a",
            eventId: "event-1",
            id: "album-student",
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "student-a",
          },
          id: "album:album-student",
          kind: "album",
          sortDate: "2026-03-14T09:00:00.000Z",
          source: "following",
        },
        {
          actor: "club",
          event: {
            clubUsername: "club-a",
            feedActorUsername: "club-a",
            id: "event-kept",
            startDate: "2026-03-14",
            title: "Kept event",
          },
          id: "event:event-kept",
          kind: "event",
          sortDate: "2026-03-14T08:00:00.000Z",
          source: "following",
        },
      ] as any,
      {
        blockedUsernames: ["blocked-club"],
        entityFilter: "all",
        sortOption: "newest",
        sourceFilter: "following",
        typeFilter: "events",
        viewerUsername: "viewer",
      } as any,
    );

    expect(items.map((item) => item.id)).toEqual(["event:event-kept"]);
  });

  it("keeps own items visible while filtering blocked following items", () => {
    const items = filterLegacyHomeItems(
      [
        {
          actor: "student",
          album: {
            clubUsername: "club-a",
            eventId: "event-1",
            id: "album-own",
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "viewer",
          },
          id: "album:album-own",
          kind: "album",
          sortDate: "2026-03-14T11:00:00.000Z",
          source: "own",
        },
        {
          actor: "club",
          event: {
            clubUsername: "club-a",
            feedActorUsername: "club-a",
            id: "event-following",
            startDate: "2026-03-14",
            title: "Followed event",
          },
          id: "event:event-following",
          kind: "event",
          sortDate: "2026-03-14T10:00:00.000Z",
          source: "following",
        },
      ] as any,
      {
        blockedUsernames: ["club-a"],
        entityFilter: "all",
        sortOption: "newest",
        sourceFilter: "following",
        typeFilter: "all",
        viewerUsername: "viewer",
      } as any,
    );

    expect(items.map((item) => item.id)).toEqual(["album:album-own"]);
  });

  it("drops home event cards attributed to followed students", () => {
    const items = filterLegacyHomeItems(
      [
        {
          actor: "student",
          event: {
            clubUsername: "kulüp-a",
            feedActorType: "student",
            feedActorUsername: "takip-edilen-Öğrenci",
            id: "event-student",
            startDate: "2026-03-14",
            title: "Öğrenci etkinligi",
          },
          id: "event:event-student",
          kind: "event",
          sortDate: "2026-03-14T11:00:00.000Z",
          source: "following",
        },
        {
          actor: "club",
          event: {
            clubUsername: "takip-edilen-kulüp",
            feedActorType: "club",
            feedActorUsername: "takip-edilen-kulüp",
            id: "event-club",
            startDate: "2026-03-14",
            title: "Kulüp etkinligi",
          },
          id: "event:event-club",
          kind: "event",
          sortDate: "2026-03-14T10:00:00.000Z",
          source: "following",
        },
      ] as any,
      {
        blockedUsernames: [],
        entityFilter: "all",
        sortOption: "newest",
        sourceFilter: "all",
        typeFilter: "events",
        viewerUsername: "viewer",
      } as any,
    );

    expect(items.map((item) => item.id)).toEqual(["event:event-club"]);
  });
});
