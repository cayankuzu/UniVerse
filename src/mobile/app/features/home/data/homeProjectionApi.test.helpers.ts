jest.mock("../../../data/content", () => ({
  AlbumAPI: {
    getPhotos: jest.fn(),
    getVisibleByEventIds: jest.fn(),
  },
  EventAPI: {
    getByClub: jest.fn(),
    getHomeFeed: jest.fn(),
    getProfileEvents: jest.fn(),
  },
  getLocalEventShadowByClubUserId: jest.fn(),
}));

jest.mock("../../../data/content/events/events.models", () => ({
  fetchEventsFromRpc: jest.fn(),
}));

jest.mock("../../../data/social/profileFollowing", () => ({
  getFollowingProfiles: jest.fn(),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../../../data/projections/projections.api.helpers", () => {
  type MockProjectionRow = Record<string, unknown> & {
    actor?: string;
    album?: MockProjectionRow;
    category?: string;
    clubUsername?: string;
    createdAt?: string;
    date?: string;
    event?: MockProjectionRow;
    feedActorType?: string;
    feedActorUsername?: string;
    feedSource?: string;
    id?: string;
    kind?: string;
    sortDate?: string;
    source?: string;
    username?: string;
  };
  type MockProjectionEnvelope = Record<string, unknown> & {
    items?: unknown[];
    updatedItems?: unknown[];
  };
  type MockLegacyFilterParams = {
    blockedUsernames?: unknown[];
    entityFilter?: string;
    sourceFilter?: string;
    typeFilter?: string;
    viewerUsername?: string;
  };
  const normalize = (value: unknown) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const nowEnvelope = (items: unknown[]) => {
    const serverTime = "2026-03-18T00:00:00.000Z";
    return {
      deletedIds: [],
      deltaToken: serverTime,
      items,
      nextCursor: null,
      serverTime,
      updatedItems: [],
    };
  };
  const toHomeProjectionItem = (row: MockProjectionRow) => {
    if (!row || typeof row !== "object") return null;
    const kind = row.kind === "album" ? "album" : row.kind === "event" ? "event" : null;
    const id = String(row.id || "").trim();
    if (!kind || !id) return null;
    return {
      actor: row.actor === "student" ? "student" : "club",
      album: row.album,
      event: row.event,
      id,
      kind,
      sortDate: String(row.sortDate || ""),
      source: row.source === "own" ? "own" : "following",
    };
  };
  const mapEnvelopeItems = (
    envelope: MockProjectionEnvelope,
    mapper: (item: unknown) => unknown,
  ) => ({
    ...envelope,
    items: (envelope.items || []).map(mapper).filter(Boolean),
    updatedItems: (envelope.updatedItems || []).map(mapper).filter(Boolean),
  });
  const buildHomeProjectionItems = ({
    albums,
    events,
    viewerUsername,
  }: {
    albums: MockProjectionRow[];
    events: MockProjectionRow[];
    viewerUsername: string;
  }) => {
    const viewer = normalize(viewerUsername);
    const eventSourceById = new Map<string, "following" | "own">();
    events.forEach((event) => {
      const id = String(event.id || "").trim();
      if (!id) return;
      const isOwn = normalize(event.clubUsername) === viewer || event.feedSource === "own";
      eventSourceById.set(id, isOwn ? "own" : "following");
    });
    return [
      ...events.map((event) => ({
        actor: event.feedActorType === "student" ? "student" : "club",
        event,
        id: `event:${event.id}`,
        kind: "event" as const,
        sortDate: event.createdAt || event.date || "",
        source: eventSourceById.get(String(event.id || "").trim()) || "following",
      })),
      ...albums.map((album) => {
        const uploader = normalize(album.username || "");
        const clubUsername = normalize(album.clubUsername || "");
        const source =
          uploader === viewer
            ? "own"
            : eventSourceById.get(String(album.eventId || "").trim()) || "following";
        return {
          actor: uploader && uploader === clubUsername ? "club" : "student",
          album,
          id: `album:${album.id}`,
          kind: "album" as const,
          sortDate: album.createdAt || "",
          source,
        };
      }),
    ];
  };
  const filterLegacyHomeItems = (items: MockProjectionRow[], params: MockLegacyFilterParams) =>
    [...items]
      .filter((item) => {
        const blockedSet = new Set(
          (params.blockedUsernames || []).map((value: unknown) => normalize(value)).filter(Boolean),
        );
        if (params.typeFilter === "events" && item.kind !== "event") return false;
        if (params.typeFilter === "albums" && item.kind !== "album") return false;
        if (params.sourceFilter === "own" && item.source !== "own") return false;
        if (
          params.sourceFilter === "following" &&
          item.source !== "following" &&
          item.source !== "own"
        ) {
          return false;
        }
        if (params.entityFilter === "clubs" && item.actor !== "club") return false;
        if (params.entityFilter === "students" && item.actor !== "student") return false;
        if (
          item.kind === "event" &&
          normalize(item.event?.feedActorType || item.actor || "") === "student"
        ) {
          return false;
        }
        const viewer = normalize(params.viewerUsername || "");
        const isOwn =
          item.kind === "event"
            ? item.source === "own" ||
              normalize(item.event?.clubUsername || "") === viewer ||
              normalize(item.event?.feedActorUsername || "") === viewer
            : normalize(item.album?.username || "") === viewer ||
              (item.actor === "club" && normalize(item.album?.clubUsername || "") === viewer);
        if (isOwn) return true;
        if (item.kind === "event") {
          return (
            !blockedSet.has(normalize(item.event?.clubUsername || "")) &&
            !blockedSet.has(normalize(item.event?.feedActorUsername || ""))
          );
        }
        return (
          !blockedSet.has(normalize(item.album?.username || "")) &&
          !blockedSet.has(normalize(item.album?.clubUsername || ""))
        );
      })
      .sort(
        (left, right) =>
          new Date(String(right.sortDate || "")).getTime() -
          new Date(String(left.sortDate || "")).getTime(),
      );
  return {
    buildHomeProjectionItems,
    filterLegacyHomeItems,
    mapEnvelopeItems,
    nowEnvelope,
    shouldFallbackToLegacy: jest.fn(() => true),
    toHomeProjectionItem,
    tryProjectionRpc: jest.fn(),
  };
});

import { resetBlockedVisibilityCache } from "../../../data/social/blockedVisibility";
import { AlbumAPI, EventAPI, getLocalEventShadowByClubUserId } from "../../../data/content";
import { fetchEventsFromRpc } from "../../../data/content/events/events.models";
import { tryProjectionRpc } from "../../../data/projections/projections.api.helpers";
import { getFollowingProfiles } from "../../../data/social/profileFollowing";
import { supabase } from "../../../platform/supabase";

export function setupHomeProjectionApiTestMocks() {
  jest.clearAllMocks();
  resetBlockedVisibilityCache();
  (fetchEventsFromRpc as jest.Mock).mockResolvedValue(null);
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
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
      maybeSingle: jest.fn(),
      order: jest.fn(),
      select: jest.fn(),
      then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue(
      table === "profiles"
        ? {
            data: {
              account_type: "student",
              username: "viewer",
            },
            error: null,
          }
        : { data: null, error: null },
    );
    return builder;
  });
  (getLocalEventShadowByClubUserId as jest.Mock).mockResolvedValue([]);
  (getFollowingProfiles as jest.Mock).mockResolvedValue([]);
  (AlbumAPI.getPhotos as jest.Mock).mockResolvedValue([]);
  (EventAPI.getProfileEvents as jest.Mock).mockResolvedValue([]);
}

export {
  AlbumAPI,
  EventAPI,
  fetchEventsFromRpc,
  getFollowingProfiles,
  getLocalEventShadowByClubUserId,
  supabase,
  tryProjectionRpc,
};
