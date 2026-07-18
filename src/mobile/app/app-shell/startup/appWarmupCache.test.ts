import { QueryClient } from "@tanstack/react-query";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { normalizeWarmupBundle } from "../../data/projections/projections.warmup";
import {
  projectionKeys,
  readProjectionItems,
  SEARCH_DISCOVERY_KINDS,
  SEARCH_DISCOVERY_SCOPE,
} from "../../data/projections";
import {
  HOME_WARMUP_SCOPE,
  NOTIFICATIONS_WARMUP_FILTER,
  resolveSearchProjectionEntity,
  seedWarmupBundleIntoCache,
} from "./appWarmupCache";

function createEnvelope<T>(items: T[]) {
  return {
    deleted_ids: [],
    delta_token: "delta-1",
    items,
    next_cursor: null,
    server_time: "2026-03-13T09:00:00.000Z",
    updated_items: [],
  };
}

function createNormalizedEnvelope<T>(items: T[]) {
  return {
    deletedIds: [],
    deltaToken: "delta-1",
    items,
    nextCursor: null,
    serverTime: "2026-03-13T09:00:00.000Z",
    updatedItems: [],
  };
}

function createEmptyWarmupBundle(source: AppWarmupBundle["source"]): AppWarmupBundle {
  return {
    generatedAt: "2026-03-13T09:00:00.000Z",
    home: createNormalizedEnvelope([]),
    homeScope: HOME_WARMUP_SCOPE,
    notificationBadge: {
      id: "notifications",
      unreadCount: 0,
    },
    notifications: createNormalizedEnvelope([]),
    profileAlbums: createNormalizedEnvelope([]),
    profileEvents: createNormalizedEnvelope([]),
    profileOverview: {
      capabilities: null,
      followStatus: "none",
      id: "viewer-1",
      profile: {} as any,
      username: "viewer",
    },
    profileUsername: "viewer",
    search: null,
    searchDiscovery: {
      albums: createNormalizedEnvelope([]),
      clubs: createNormalizedEnvelope([]),
      events: createNormalizedEnvelope([]),
      students: createNormalizedEnvelope([]),
    },
    source,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("seedWarmupBundleIntoCache", () => {
  it("normalizes a warmup payload and seeds home, profile, notifications, and discovery keys", () => {
    const rawPayload = {
      generated_at: "2026-03-13T09:00:00.000Z",
      home_payload: createEnvelope([
        {
          actor: "club",
          event: {
            access: "public",
            address: "Campus",
            attendees: 12,
            club: "Chess Club",
            clubImage: "",
            clubUserId: "club-1",
            clubUsername: "chessclub",
            createdAt: "2026-03-13T08:00:00.000Z",
            date: "2026-03-13",
            description: "Board games",
            endDate: "2026-03-13",
            endTime: "20:00",
            id: "event-1",
            image: "",
            joined: false,
            likes: 10,
            liked: false,
            location: "Student Center",
            startDate: "2026-03-13",
            startTime: "18:00",
            title: "Chess Night",
            university: "UniVerse",
            visibility: "public",
          },
          id: "event:event-1",
          kind: "event",
          sort_date: "2026-03-13T08:00:00.000Z",
          source: "following",
        },
      ]),
      notification_badge: {
        id: "notifications",
        unread_count: 3,
      },
      notifications_payload: createEnvelope([
        {
          createdAt: "2026-03-13T08:30:00.000Z",
          fromImage: "",
          fromName: "Ada",
          fromUserId: "user-2",
          fromUsername: "ada",
          id: "notification-1",
          message: "liked your event",
          read: false,
          targetType: "event",
          time: "1m",
          type: "like",
        },
      ]),
      profile_overview: {
        capabilities: null,
        followStatus: "none",
        id: "viewer-1",
        profile: {
          id: "viewer-1",
          username: "viewer",
        },
        username: "viewer",
      },
      profile_albums: createEnvelope([
        {
          caption: "A great night",
          comments: 1,
          createdAt: "2026-03-13T08:15:00.000Z",
          eventId: "event-1",
          eventTitle: "Chess Night",
          id: "album-1",
          image: "",
          liked: false,
          likes: 4,
          name: "Viewer",
          title: "Album One",
          userId: "viewer-1",
          username: "viewer",
        },
      ]),
      profile_events: createEnvelope([
        {
          access: "public",
          address: "Campus",
          attendees: 12,
          club: "Chess Club",
          clubImage: "",
          clubUserId: "club-1",
          clubUsername: "chessclub",
          createdAt: "2026-03-13T08:00:00.000Z",
          date: "2026-03-13",
          description: "Board games",
          endDate: "2026-03-13",
          endTime: "20:00",
          id: "event-1",
          image: "",
          joined: false,
          likes: 10,
          liked: false,
          location: "Student Center",
          startDate: "2026-03-13",
          startTime: "18:00",
          title: "Chess Night",
          university: "UniVerse",
          visibility: "public",
        },
      ]),
      search: {
        content: createEnvelope([
          {
            access: "public",
            address: "Campus",
            attendees: 12,
            club: "Chess Club",
            clubImage: "",
            clubUserId: "club-1",
            clubUsername: "chessclub",
            createdAt: "2026-03-13T08:00:00.000Z",
            date: "2026-03-13",
            description: "Board games",
            endDate: "2026-03-13",
            endTime: "20:00",
            id: "event-typed-1",
            image: "",
            joined: false,
            likes: 10,
            liked: false,
            location: "Student Center",
            startDate: "2026-03-13",
            startTime: "18:00",
            title: "Typed Result",
            university: "UniVerse",
            visibility: "public",
          },
        ]),
        kind: "events",
        scope: "query=chess",
      },
      search_discovery: {
        albums: createEnvelope([
          {
            comments: 0,
            createdAt: "2026-03-13T08:10:00.000Z",
            eventId: "event-1",
            eventTitle: "Chess Night",
            id: "search-album-1",
            image: "",
            liked: false,
            likes: 0,
            name: "Viewer",
            title: "Search Album",
            userId: "viewer-1",
            username: "viewer",
          },
        ]),
        clubs: createEnvelope([
          {
            accountType: "club",
            coverImage: "",
            id: "club-1",
            image: "",
            isPrivate: false,
            name: "Chess Club",
            university: "UniVerse",
            username: "chessclub",
          },
        ]),
        events: createEnvelope([
          {
            access: "public",
            address: "Campus",
            attendees: 12,
            club: "Chess Club",
            clubImage: "",
            clubUserId: "club-1",
            clubUsername: "chessclub",
            createdAt: "2026-03-13T08:00:00.000Z",
            date: "2026-03-13",
            description: "Board games",
            endDate: "2026-03-13",
            endTime: "20:00",
            id: "search-event-1",
            image: "",
            joined: false,
            likes: 10,
            liked: false,
            location: "Student Center",
            startDate: "2026-03-13",
            startTime: "18:00",
            title: "Search Event",
            university: "UniVerse",
            visibility: "public",
          },
        ]),
        students: createEnvelope([
          {
            accountType: "student",
            coverImage: "",
            id: "student-1",
            image: "",
            isPrivate: false,
            name: "Viewer",
            university: "UniVerse",
            username: "viewer",
          },
        ]),
      },
    };
    const bundle = normalizeWarmupBundle(rawPayload);
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";

    expect(bundle).not.toBeNull();
    seedWarmupBundleIntoCache({
      bundle: bundle!,
      queryClient,
      viewerKey,
      viewerUsername: "viewer",
    });

    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.home(viewerKey, HOME_WARMUP_SCOPE),
        "home-feed",
      ),
    ).toHaveLength(1);
    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 3,
    });
    expect(bundle).toEqual(expect.objectContaining({ source: "rpc" }));
    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.notifications(viewerKey, NOTIFICATIONS_WARMUP_FILTER),
        "notifications",
      ),
    ).toHaveLength(1);
    expect(queryClient.getQueryData(projectionKeys.profileOverview("viewer", viewerKey))).toEqual(
      expect.objectContaining({ username: "viewer" }),
    );
    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.profileContent("viewer", "album", viewerKey),
        "profile-albums",
      ),
    ).toHaveLength(1);
    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.profileContent("viewer", "events", viewerKey),
        "profile-events",
      ),
    ).toHaveLength(1);

    SEARCH_DISCOVERY_KINDS.forEach((kind) => {
      expect(
        readProjectionItems(
          queryClient,
          projectionKeys.search(kind, viewerKey, SEARCH_DISCOVERY_SCOPE),
          resolveSearchProjectionEntity(kind),
        ),
      ).toHaveLength(1);
    });

    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.search("events", viewerKey, "query=chess"),
        "search-events",
      ),
    ).toHaveLength(1);
  });

  it("preserves the existing notification badge when warmup times out under backpressure", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";
    queryClient.setQueryData(projectionKeys.notificationBadge(viewerKey), {
      id: "notifications",
      unreadCount: 7,
    });

    seedWarmupBundleIntoCache({
      bundle: createEmptyWarmupBundle("timeout-backpressure"),
      queryClient,
      viewerKey,
      viewerUsername: "viewer",
    });

    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 7,
    });
  });

  it("preserves the existing notification badge when fallback warmup has no notification authority", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";
    queryClient.setQueryData(projectionKeys.notificationBadge(viewerKey), {
      id: "notifications",
      unreadCount: 5,
    });

    seedWarmupBundleIntoCache({
      bundle: createEmptyWarmupBundle("fallback"),
      queryClient,
      viewerKey,
      viewerUsername: "viewer",
    });

    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 5,
    });
  });
});
